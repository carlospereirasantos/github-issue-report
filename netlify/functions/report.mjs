import { readFileSync } from "node:fs";
import { App } from "octokit";

function loadKey() {
    if (process.env.GITHUB_PRIVATE_KEY_BASE64)
        return Buffer.from(process.env.GITHUB_PRIVATE_KEY_BASE64, "base64").toString("utf8");
    if (process.env.GITHUB_PRIVATE_KEY)
        return process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, "\n");
    return readFileSync(process.env.GITHUB_PRIVATE_KEY_PATH, "utf8");
}

const privateKey = loadKey();

console.log("Key check:", {
    length: privateKey.length,
    firstLine: privateKey.split("\n")[0].trim(),
    lastLine: privateKey.trim().split("\n").pop().trim(),
    lines: privateKey.split("\n").length,
    hasCarriageReturn: privateKey.includes("\r"),
});

const ghApp = new App({ appId: process.env.GITHUB_APP_ID, privateKey });

const TYPES = {
    crash: { label: "crash-log", prefix: "Crash Log" },
    bug: { label: "bug", prefix: "Bug" },
    feature: { label: "feature-request", prefix: "Feature request" },
    suggestion: { label: "suggestion", prefix: "Suggestion" },
};

const clean = (v, max) =>
    String(v ?? "").slice(0, max).replace(/@/g, "@\u200b");

export default async (req) => {
    if (req.method !== "POST") return new Response(null, { status: 405 });

    let data;
    try {
        data = await req.json();
    } catch {
        return Response.json({ error: "Invalid request" }, { status: 400 });
    }

    const { type, title, body, version, os } = data || {};
    if (!title || !body)
        return Response.json({ error: "Missing text" }, { status: 400 });
    if (typeof type !== "string" || !Object.hasOwn(TYPES, type))
        return Response.json({ error: "Unknown type" }, { status: 400 });

    const kind = TYPES[type];

    try {
        const octokit = await ghApp.getInstallationOctokit(
            Number(process.env.GITHUB_INSTALLATION_ID)
        );
        const issue = await octokit.rest.issues.create({
            owner: process.env.GITHUB_OWNER,
            repo: process.env.GITHUB_REPO,
            title: "[" + kind.prefix + "] " + clean(title, 120),
            body: clean(body, 4000) + "\n\n---\nVersion: " + clean(version, 20) +
                "\nSystem: " + clean(os, 40),
            labels: ["from-app", kind.label],
        });
        return Response.json({ reference: issue.data.number }, { status: 201 });
    } catch (error) {
        console.error("Report failed:", error.message);
        return Response.json({ error: "Could not create the report" }, { status: 502 });
    }
};

export const config = { path: "/api/report" };
