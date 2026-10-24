# Github-issue-report
create GitHub issues from any app, without user accounts

A tiny serverless function that receives a report as JSON and creates an issue in a private GitHub repository. The app that sends the report needs no GitHub account and holds no secret. The secret stays in the service.
It uses (free) Netlify online servie

```
Your app  ->  this service (Netlify function)  ->  private GitHub repository
```

Use it for bug reports, feature requests and suggestions from desktop apps, mobile apps, tools and scripts.

Status: written and tested in October 2026 with Windows, Node 24 and Netlify CLI 27. The macOS and Linux commands in this guide follow the same steps but were not tested on those systems. Prices, limits and menu names of GitHub and Netlify change, so check them when you set this up.

## Contents

1. How it works
2. What you need
3. Set up the development environment
4. Set up GitHub (the App, the key, the labels)
5. Create the project files
6. Test locally
7. Set up Netlify (site, visibility, variables, base64 key)
8. Test remotely and deploy
9. The JSON format and how to reach the service
10. Troubleshooting
11. Security notes
12. Maintenance (rotating the key, updates, costs)
13. Alternatives to Netlify
14. Appendix: all files

## 1. How it works

A GitHub App is an identity with a private key. It cannot receive messages. Something must hold the key and call GitHub. That is this service.

1. Your app sends a POST request with a small JSON report.
2. The function checks the input and chooses a label from a fixed list.
3. The function signs in as the GitHub App with the private key, and gets a short lived installation token from GitHub.
4. The function creates the issue in your repository and answers with the issue number.

Why not call GitHub directly from the app? GitHub accepts an issue only with a token. A token inside an app can be extracted by anyone, and for a private repository it would give access to your issues.

## 2. What you need

* A GitHub account and a private repository that will receive the issues.
* A free Netlify account.
* Node.js (version 20 or newer) and npm.
* A code editor, such as VS Code.
* A terminal (PowerShell on Windows, Terminal on macOS or Linux).

## 3. Set up the development environment

1. Check Node:
   ```
   node --version
   ```
2. Install the Netlify command line tool:
   ```
   npm install -g netlify-cli
   ```
   You will see warnings about deprecated packages and a number of reported vulnerabilities. They belong to the tool's own dependencies and do not affect your project. Do not run `npm audit fix --force`. Update the tool now and then with `npm install -g netlify-cli@latest`.
3. Check the install:
   ```
   netlify --version
   ```
   Newer npm versions can block install scripts of dependencies. If the check fails with errors about `esbuild` or `unix-dgram`, run:
   ```
   npm install -g --allow-scripts=netlify-cli,esbuild,unix-dgram
   ```
   If the check works, you do not need this command.
4. Create the project folder:
   ```
   mkdir feedback-relay
   cd feedback-relay
   npm init -y
   npm install octokit
   ```
5. Optional: if you want to run the project without a global tool, use `npx netlify-cli dev` instead of `netlify dev`.

## 4. Set up GitHub

### 4.1 Create the GitHub App

1. On GitHub: your profile picture, Settings, Developer settings, GitHub Apps, New GitHub App.
2. GitHub App name: for example `Feedback Relay`. The name must be unique on GitHub.
3. Homepage URL: the address of your repository or any web address.
4. Leave the callback URL empty.
5. Webhook: untick Active. The app only creates issues, so it needs no webhook.
6. Repository permissions: set Issues to Read and write. Leave everything else at No access. GitHub adds the read only Metadata permission by itself.
7. Where can this GitHub App be installed: Only on this account.
8. Press Create GitHub App.
9. Write down the App ID, a number at the top of the app page. It is not a secret.

### 4.2 Generate the private key

1. On the app page, scroll to Private keys and press Generate a private key.
2. A file ending in `.pem` downloads. GitHub keeps no copy. Move it to a safe folder outside any repository.
3. Never email it, paste it in a chat, commit it, or print it in a log.

### 4.3 Install the app on the repository

1. In the left menu of the app page, click Install App, then Install next to your account.
2. Choose Only select repositories and pick the private repository that will receive the issues.
3. After installing, look at the address in your browser. It ends with a number, for example `settings/installations/12345678`. That number is the installation ID. Write it down. It is not a secret.

### 4.4 Create the labels

The function adds the label `from-app` and one type label to every issue. Create them in the repository (Issues, Labels, New label), so GitHub does not refuse the issue:

| Label | Meaning |
|---|---|
| `from-app` | The issue came through the relay |
| `bug` | Type `bug` |
| `feature-request` | Type `feature` |
| `suggestion` | Type `suggestion` |

With the GitHub command line tool (`gh`) you can create them in one go:

```
gh label create from-app --description "Reported from the app" --color 0E8A16
gh label create bug --description "Something is broken" --color D73A4A
gh label create feature-request --description "A new feature" --color A2EEEF
gh label create suggestion --description "An idea or improvement" --color FEF2C0
```

If `bug` already exists, the command reports it. That is fine.

### 4.5 Values to collect

| Value | Where to find it |
|---|---|
| App ID | Top of the GitHub App page |
| Installation ID | End of the address after installing the app |
| Owner | Your GitHub user name or organization, written exactly |
| Repository | The repository name only, not the web address |
| Private key file | The `.pem` file you saved |

## 5. Create the project files

The structure:

```
feedback-relay/
  netlify/functions/report.mjs
  public/index.html
  netlify.toml
  package.json
  .env              (local only, never committed)
  .env.example
  .gitignore
  README.md
```

Create the folders and files. The full contents are in section 14.

Windows (PowerShell):
```
mkdir netlify\functions
mkdir public
```

macOS and Linux:
```
mkdir -p netlify/functions public
```

Create the files in your editor, not with Notepad, which can add `.txt` to the file name.

### The `.env` file for local tests

In the project root (next to `package.json`), create `.env`:

```
GITHUB_APP_ID=123456
GITHUB_INSTALLATION_ID=12345678
GITHUB_PRIVATE_KEY_PATH=C:/keys/feedback-relay.pem
GITHUB_OWNER=your-github-username
GITHUB_REPO=your-private-repository
```

Rules:
* One `NAME=value` per line. No spaces around `=`. No quotation marks.
* Use forward slashes in the path, also on Windows. On macOS the path looks like `/Users/yourname/keys/feedback-relay.pem`.
* `GITHUB_OWNER` is only a name. `GITHUB_REPO` is only the repository name. Do not put web addresses in them.
* The file must sit in the project root, not in the `netlify` folder.

Create `.gitignore` so the secrets never reach a repository:

```
.env
*.pem
node_modules
.netlify
```

## 6. Test locally

1. Start the local server in the project folder:
   ```
   netlify dev
   ```
   If it asks you to log in or link a site, you can say no for now. Wait for the message that the server is ready on port 8888. Leave this terminal open. The `.env` file is read at start up, so restart the command after every change to it.
2. In a second terminal send a test report.

   PowerShell:
   ```
   Invoke-RestMethod -Method Post -Uri http://localhost:8888/api/report -ContentType "application/json" -Body '{"type":"bug","title":"Local test","body":"Hello","version":"0.1.0","os":"win32"}'
   ```
   macOS and Linux:
   ```
   curl -X POST http://localhost:8888/api/report \
     -H "Content-Type: application/json" \
     -d '{"type":"bug","title":"Local test","body":"Hello","version":"0.1.0","os":"darwin"}'
   ```
3. Expected answer:
   ```
   reference
   ---------
          96
   ```
   The number is the issue number.
4. Open the repository on GitHub. A new issue should exist with the title `[Bug] Local test` and the labels `from-app` and `bug`. Close the test issue.
5. Repeat with `"type":"feature"` and `"type":"suggestion"` and check the labels and the title prefixes.
6. If something fails, read the first terminal. The function prints `Report failed:` with the reason. See section 10.

## 7. Set up Netlify

### 7.1 Log in and create the site

1. Log in. A browser window opens:
   ```
   netlify login
   ```
2. Make a first draft deploy. This creates the site:
   ```
   netlify deploy
   ```
   When asked, choose to create and configure a new project, pick your team, and enter a unique lowercase site name, for example `feedback-relay-yourname`. If it asks for a publish directory, enter `public`. The result is a draft deploy with its own preview address.

### 7.2 Make the production site public

New projects can start private. Then every request, including the ones from your app, receives a Netlify login page instead of an answer. A private project shows this as an HTML page called "Login Redirect".

1. In the Netlify dashboard open your site: Project configuration, General, Visitor access, Project visibility.
2. Set production to public. The app has no Netlify login, so it could not reach a private service.
3. Previews can stay private. Draft deploys then cannot be called from outside. Test remotely on the production address, or make previews public only while you test.

### 7.3 Add the environment variables

In the dashboard open Site configuration, Environment variables, Add a variable. Add these five:

| Name | Value |
|---|---|
| `GITHUB_APP_ID` | The App ID |
| `GITHUB_INSTALLATION_ID` | The installation ID |
| `GITHUB_OWNER` | Your user name or organization |
| `GITHUB_REPO` | The repository name |
| `GITHUB_PRIVATE_KEY_BASE64` | The key as one line of base64 text (section 7.4) |

Do not add `GITHUB_PRIVATE_KEY_PATH`. That variable is only for local tests. Keep Functions among the scopes of every variable, and mark the key as a secret if the page offers it.

### 7.4 Create the base64 text of the key

Pasting a multi line key into an environment variable can change its line breaks, and the function then fails with `error:1E08010C:DECODER routines::unsupported` or `Invalid keyData`. A single line of base64 text avoids that.

Windows (PowerShell). This copies the result to the clipboard without showing it:
```
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\keys\feedback-relay.pem")) | Set-Clipboard
```

macOS:
```
base64 -i ~/keys/feedback-relay.pem | pbcopy
```

Linux:
```
base64 -w 0 ~/keys/feedback-relay.pem
```
Copy the printed text, or pipe it to your clipboard tool.

Then paste it as the value of `GITHUB_PRIVATE_KEY_BASE64` in the Netlify dashboard. Copy some other text afterwards, so the key does not stay in your clipboard. Base64 is only a way of writing the key as text. Anyone who sees it can decode it, so treat it exactly like the key itself.

### 7.5 Check the setting for old deploys

Under the project settings, "Automatic deploy deletion" removes old deploys after a retention period (30 days by default on the free plan at the time of writing). It never removes the current live deploy. You can leave the default.

## 8. Test remotely and deploy

Variables reach a function only through a deploy made after they exist.

1. Make a draft deploy, then production:
   ```
   netlify deploy
   netlify deploy --prod
   ```
   A production deploy costs credits on the free plan (section 12).
2. Test the live address, which ends with `/api/report`:

   PowerShell:
   ```
   Invoke-RestMethod -Method Post -Uri https://YOUR-SITE.netlify.app/api/report -ContentType "application/json" -Body '{"type":"suggestion","title":"Live test","body":"Hello","version":"0.1.0","os":"win32"}'
   ```
   macOS and Linux:
   ```
   curl -X POST https://YOUR-SITE.netlify.app/api/report \
     -H "Content-Type: application/json" \
     -d '{"type":"suggestion","title":"Live test","body":"Hello","version":"0.1.0","os":"darwin"}'
   ```
3. Check that the issue exists with the right labels, then close it.
4. Test the error cases too. Each answer should match the table in section 9:
   * a `type` that is not one of the three values gives 400 `Unknown type`
   * an empty `title` gives 400 `Missing text`
   * a GET request gives 405
5. Read the function logs when something fails: the Netlify dashboard, Logs, Functions, `report`.

## 9. The JSON format and how to reach it

### Address

```
POST https://YOUR-SITE.netlify.app/api/report
```

The path `/api/report` comes from the `config.path` line at the end of the function file. Change it there if you want another path. Only POST is accepted. There is no authentication.

### Request

Header `Content-Type: application/json`. The body:

```json
{
  "type": "bug",
  "title": "Short summary",
  "body": "What happened, what was expected, and the steps to repeat it.",
  "version": "1.2.3",
  "os": "win32 10.0.26100"
}
```

| Field | Required | Values and limits |
|---|---|---|
| `type` | yes | Exactly one of `bug`, `feature`, `suggestion` |
| `title` | yes | Text. Cut at 120 characters |
| `body` | yes | Text. Cut at 4000 characters |
| `version` | no | Your app version. Cut at 20 characters |
| `os` | no | Platform and release. Cut at 40 characters |

The service ignores any other field. It does not accept labels from the caller. It maps each `type` to a fixed label.

### Responses

| Status | Body | Meaning |
|---|---|---|
| 201 | `{ "reference": 96 }` | The issue was created. `reference` is the issue number |
| 400 | `{ "error": "Invalid request" }` | The body is not valid JSON |
| 400 | `{ "error": "Missing text" }` | `title` or `body` is empty |
| 400 | `{ "error": "Unknown type" }` | `type` is not one of the three values |
| 405 | none | The method was not POST |
| 502 | `{ "error": "Could not create the report" }` | The service could not reach GitHub or GitHub refused. The reason is in the function log, never in the answer |

### What appears on GitHub

* Title: a prefix and your title: `[Bug] ...`, `[Feature request] ...` or `[Suggestion] ...`.
* Labels: `from-app` and one of `bug`, `feature-request`, `suggestion`.
* Body: your text, then a line with `---`, then `Version:` and `System:`.
* Every `@` in the text is followed by an invisible character, so a report cannot mention or notify people.

### Examples of how to call it

curl:
```
curl -X POST https://YOUR-SITE.netlify.app/api/report \
  -H "Content-Type: application/json" \
  -d '{"type":"bug","title":"Crash on start","body":"Steps: open the app.","version":"1.2.3","os":"linux"}'
```

PowerShell:
```
Invoke-RestMethod -Method Post -Uri https://YOUR-SITE.netlify.app/api/report -ContentType "application/json" -Body '{"type":"bug","title":"Crash on start","body":"Steps: open the app.","version":"1.2.3","os":"win32"}'
```

JavaScript (Node 18 or newer, Electron main process, or any server):
```js
const res = await fetch("https://YOUR-SITE.netlify.app/api/report", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    type: "bug",
    title: "Crash on start",
    body: "Steps: open the app.",
    version: "1.2.3",
    os: process.platform,
  }),
});
const data = await res.json();
if (res.status === 201) console.log("Issue number", data.reference);
else console.error(res.status, data.error);
```

### Calling it from a browser

The function sets no CORS headers. A web page on another domain cannot call it, because the browser blocks the request. Call the service from a server, from a desktop app (for example the Electron main process, not the renderer), or from a script. If you really need browser calls, add CORS headers and handle the `OPTIONS` request in the function. That is not covered here and not tested.

### Rules for callers

* Treat the answer as untrusted data. Show a fixed message and the reference number, never server text as HTML.
* Show the user what is sent before sending it, and tell them not to include passwords or personal data.
* Limit how often your app sends (for example one report every 30 seconds).
* Never place a token or the key in your app.

## 10. Troubleshooting

Always read the function log first. Locally, it is the terminal that runs `netlify dev`. Online, it is Logs, Functions in the dashboard. The function prints `Report failed:` with the reason.

| What you see | Cause | Fix |
|---|---|---|
| `The "path" argument must be of type string ... Received undefined` at `readFileSync` | The `.env` file was not loaded, so `GITHUB_PRIVATE_KEY_PATH` is missing | Check that `.env` sits in the project root and is not called `.env.txt`. Check the variable names. Restart `netlify dev` |
| 502 and `Not Found` for `create-an-issue`, with a very long encoded address in the message | `GITHUB_REPO` (or the owner) holds a web address | Use names only: `GITHUB_OWNER=name`, `GITHUB_REPO=repo` |
| 502 and `Not Found` for `create-an-installation-access-token` | Wrong installation ID, or the app is not installed | Check the number at the end of the installation address |
| `Integration not found` or `Bad credentials` | Wrong App ID, or a key from another app | Use the App ID (not the installation ID) and the key of this app |
| `Resource not accessible by integration` | The app lacks Issues read and write, or it is not installed on that repository | Fix the permission, accept the permission update in the installation settings, check the repository selection |
| `Validation Failed` | A label does not exist | Create the four labels (section 4.4) |
| `error:1E08010C:DECODER routines::unsupported` | The key text was changed by pasting it | Use `GITHUB_PRIVATE_KEY_BASE64` (section 7.4) |
| `Invalid keyData` | The variable holds something that is not the key, for example base64 text in a plain key variable, a name mismatch, or a cut value | Use exactly the name `GITHUB_PRIVATE_KEY_BASE64`, with Functions in its scopes, and paste the base64 of the whole file again |
| The answer is an HTML page called "Login Redirect" | The project or the previews are private | Set the visibility to public (section 7.2) |
| 404 on a draft address | The address misses `/api/report`, or the draft was deleted | Add the path, or make a new draft |
| 502 only on Netlify, while the local test works | The variables were added after the deploy | Deploy again |
| Messages about `iat` or `exp` claims | The clock of the computer or server is wrong | Turn on automatic time |
| Warnings after `npm install -g netlify-cli` | Deprecated packages inside the tool | Ignore them |

## 11. Security notes

* **The key is the secret.** Anyone with the `.pem` file, or its base64 text, can act as the app. The app can only read and write issues of the repositories where you installed it, but treat the key with care.
* **Never log key material.** A debugging line that prints a key value puts the key in the function log. This happened once during this setup. If it happens to you, replace the key at once (section 12).
* **Checks that print values must print only true or false**, or the length of a value.
* **The endpoint is public by design.** Anyone who knows the address can call it. The function limits the size of every field, accepts only three types and maps them to fixed labels, and neutralizes `@` mentions. It does not limit the number of requests.
* **Add rate limiting before you publish the address in a released app.** Netlify offers firewall rules and basic rate limiting on its plans. Check the current plan. A counter inside the function resets when the platform starts a new instance, so it is only a weak extra.
* **Use the smallest permission.** The app needs only Issues read and write, and one repository.
* **Privacy.** Reports are personal data if users write personal data in them. Tell users what is sent and where it goes, add a contact address for removal requests, and know that the host keeps technical logs. In the EU this falls under GDPR.
* **Do not commit** `.env`, `.pem` files or logs. The `.gitignore` in section 14 covers the first two. Enable secret scanning on any public repository.

## 12. Maintenance

### Replace the key (rotate it)

Do this at least once if a key was ever exposed, and when someone who had access leaves.

1. GitHub App page, Private keys, Generate a private key. Save the new `.pem` file.
2. Make the base64 text of the new file (section 7.4).
3. In Netlify, replace the value of `GITHUB_PRIVATE_KEY_BASE64`.
4. Update the path in your local `.env`.
5. Deploy again and test.
6. Delete the old key on the GitHub App page, and delete the old file from your computer.

### Update the tools

```
npm install -g netlify-cli@latest
npm update octokit
```

The Octokit library may print a notice about a deprecated API version. It does not stop the service.

### Costs on the Netlify free plan

At the time of writing (October 2026), the free plan gives 300 credits a month, with a hard limit. One shared budget pays for deploys, compute, bandwidth and requests:

| Item | Cost in credits |
|---|---|
| Production deploy | 15 each |
| Function compute | 10 per GB hour |
| Bandwidth | 20 per GB |
| Web requests, including calls to functions | 2 per 10,000 |

Draft deploys, failed deploys and rollbacks cost no credits. For a feedback relay the deploys are the main cost: 300 credits pay for 20 production deploys. A report costs a tiny fraction of a credit. Someone sending junk can use the budget up, which is one more reason to add rate limiting. Check the current Netlify pricing page and terms, including the terms about commercial use, before you rely on the free plan for a product.

## 13. Alternatives to Netlify

The function logic is small, so the host can change. The format of the function file differs per host.

* **Vercel:** similar, but the free Hobby plan is for personal, non commercial use only.
* **Cloudflare Workers:** edge functions with a free tier. Needs changes to the function.
* **Your own small server:** run the same logic in an Express program behind a web server such as Caddy, on a rented server in your region.

Keep the service address as one setting in every app that uses it, so moving the host means changing one value.

## 14. Appendix: all files

### `netlify/functions/report.mjs`

```js
import { readFileSync } from "node:fs";
import { App } from "octokit";

// Key sources, in order: base64 text (online), plain text, file path (local tests).
function loadKey() {
  if (process.env.GITHUB_PRIVATE_KEY_BASE64)
    return Buffer.from(process.env.GITHUB_PRIVATE_KEY_BASE64, "base64").toString("utf8");
  if (process.env.GITHUB_PRIVATE_KEY)
    return process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, "\n");
  return readFileSync(process.env.GITHUB_PRIVATE_KEY_PATH, "utf8");
}

const ghApp = new App({
  appId: process.env.GITHUB_APP_ID,
  privateKey: loadKey(),
});

// The caller picks a type. The function picks the label. Never pass labels through.
const TYPES = {
  bug: { label: "bug", prefix: "Bug" },
  feature: { label: "feature-request", prefix: "Feature request" },
  suggestion: { label: "suggestion", prefix: "Suggestion" },
};

// Cut the text and put an invisible character after every @ so nobody is mentioned.
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
      body:
        clean(body, 4000) +
        "\n\n---\nVersion: " + clean(version, 20) +
        "\nSystem: " + clean(os, 40),
      labels: ["from-app", kind.label],
    });
    return Response.json({ reference: issue.data.number }, { status: 201 });
  } catch (error) {
    // Log the message only. Never log the request body or any key.
    console.error("Report failed:", error.message);
    return Response.json({ error: "Could not create the report" }, { status: 502 });
  }
};

export const config = { path: "/api/report" };
```

### `netlify.toml`

```
[build]
  publish = "public"

[functions]
  directory = "netlify/functions"
```

### `public/index.html`

```html
<!doctype html>
<title>Feedback relay</title>
<p>Feedback relay service.</p>
```

### `package.json`

`npm init -y` creates it. `npm install octokit` adds the dependency. The result looks like this, with your own version numbers:

```json
{
  "name": "feedback-relay",
  "version": "1.0.0",
  "private": true,
  "dependencies": {
    "octokit": "^x.y.z"
  }
}
```

### `.env.example` (commit this one, without real values)

```
GITHUB_APP_ID=
GITHUB_INSTALLATION_ID=
GITHUB_PRIVATE_KEY_PATH=
GITHUB_OWNER=
GITHUB_REPO=
```

### `.gitignore`

```
.env
*.pem
node_modules
.netlify
```

### Checklist before you publish the repository

* No `.env` file, no `.pem` file and no key text anywhere in the history.
* `.env.example` has only empty values.
* Replace `YOUR-SITE`, `OWNER` and `REPO` in the examples, or keep them as placeholders.
* Add a `LICENSE` file. MIT is a common choice for a small tool like this.
* Add a short `SECURITY.md` that says how to report a problem privately.
* Do not publish the address of your live service in the documentation, unless you want the public to use it.
