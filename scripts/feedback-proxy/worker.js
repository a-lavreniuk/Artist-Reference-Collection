/**
 * Cloudflare Worker — прокси для создания GitHub Issues из ARC.
 *
 * Secrets (wrangler secret put):
 *   GITHUB_TOKEN   — fine-grained PAT с Issues: Read and write
 *   GITHUB_REPO    — owner/repo (например a-lavreniuk/Artist-Reference-Collection)
 *   FEEDBACK_API_KEY — общий ключ для бэта-сборок (Bearer в Authorization)
 *
 * Deploy: npx wrangler deploy
 */

const MAX_BODY_BYTES = 64 * 1024;
const MAX_ATTACHMENTS = 5;

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function uploadIssueAsset(token, repo, issueNumber, fileName, base64, mimeType) {
  const [owner, name] = repo.split('/');
  const binary = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const form = new FormData();
  form.append('file', new Blob([binary], { type: mimeType }), fileName);

  const res = await fetch(`https://uploads.github.com/repos/${owner}/${name}/issues/${issueNumber}/assets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: form
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`asset upload failed: ${res.status} ${text.slice(0, 120)}`);
  }

  return res.json();
}

async function createIssue(token, repo, title, body, labels) {
  const [owner, name] = repo.split('/');
  const res = await fetch(`https://api.github.com/repos/${owner}/${name}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: JSON.stringify({ title, body, labels })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`create issue failed: ${res.status} ${text.slice(0, 200)}`);
  }

  return res.json();
}

async function updateIssueBody(token, repo, issueNumber, body) {
  const [owner, name] = repo.split('/');
  await fetch(`https://api.github.com/repos/${owner}/${name}/issues/${issueNumber}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: JSON.stringify({ body })
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const auth = request.headers.get('Authorization') ?? '';
    const expected = `Bearer ${env.FEEDBACK_API_KEY}`;
    if (!env.FEEDBACK_API_KEY || auth !== expected) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) {
      return jsonResponse({ error: 'Server not configured' }, 500);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400);
    }

    const title = typeof payload.title === 'string' ? payload.title.trim().slice(0, 256) : '';
    let body = typeof payload.body === 'string' ? payload.body : '';
    const labels = Array.isArray(payload.labels)
      ? payload.labels.filter((l) => typeof l === 'string').slice(0, 10)
      : ['beta-feedback', 'from-app'];

    if (!title || !body.trim()) {
      return jsonResponse({ error: 'title and body required' }, 400);
    }

    if (body.length > MAX_BODY_BYTES) {
      body = `${body.slice(0, MAX_BODY_BYTES)}\n\n… (обрезано)`;
    }

    try {
      const issue = await createIssue(env.GITHUB_TOKEN, env.GITHUB_REPO, title, body, labels);
      const issueNumber = issue.number;
      const attachments = Array.isArray(payload.attachments) ? payload.attachments.slice(0, MAX_ATTACHMENTS) : [];
      const assetLinks = [];

      for (const att of attachments) {
        if (!att || typeof att.base64 !== 'string' || typeof att.fileName !== 'string') continue;
        try {
          const asset = await uploadIssueAsset(
            env.GITHUB_TOKEN,
            env.GITHUB_REPO,
            issueNumber,
            att.fileName,
            att.base64,
            att.mimeType || 'application/octet-stream'
          );
          if (asset?.url) {
            assetLinks.push(`![${att.fileName}](${asset.url})`);
          }
        } catch {
          /* skip failed attachment */
        }
      }

      if (assetLinks.length > 0) {
        const nextBody = `${body}\n\n## Вложения\n\n${assetLinks.join('\n\n')}`;
        await updateIssueBody(env.GITHUB_TOKEN, env.GITHUB_REPO, issueNumber, nextBody);
      }

      return jsonResponse({
        issueNumber,
        issueUrl: issue.html_url
      });
    } catch (err) {
      return jsonResponse({ error: err instanceof Error ? err.message : String(err) }, 502);
    }
  }
};
