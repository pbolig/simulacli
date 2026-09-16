import { CONFIG, getStoredConfig } from "../config.js";

/**
 * GitHub REST API JSON Database Sync Engine
 * Allows committing changes directly back to your GitHub Repository (data/*.json)
 * without needing Supabase or external servers!
 */
export class GitHubSyncEngine {
  constructor() {
    this.repoOwner = getStoredConfig("simulacli_gh_owner", "");
    this.repoName = getStoredConfig("simulacli_gh_repo", "");
    this.token = getStoredConfig("simulacli_gh_token", "");
  }

  isConfigured() {
    return !!(this.repoOwner && this.repoName && this.token);
  }

  /**
   * Commit updated JSON data directly to GitHub Repository
   */
  async commitJsonFile(pathInRepo, jsonData, commitMessage = "auto: update database json") {
    if (!this.isConfigured()) {
      console.log(`GitHub Sync not configured for ${pathInRepo}. Operating locally.`);
      return false;
    }

    const apiUrl = `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/${pathInRepo}`;
    const contentEncoded = btoa(unescape(encodeURIComponent(JSON.stringify(jsonData, null, 2))));

    try {
      // 1. Get current SHA if file exists
      let sha = null;
      const getRes = await fetch(apiUrl, {
        headers: {
          "Authorization": `Bearer ${this.token}`,
          "Accept": "application/vnd.github.v3+json"
        }
      });

      if (getRes.ok) {
        const fileInfo = await getRes.json();
        sha = fileInfo.sha;
      }

      // 2. Commit updated JSON file
      const bodyPayload = {
        message: commitMessage,
        content: contentEncoded,
        branch: "main"
      };
      if (sha) bodyPayload.sha = sha;

      const putRes = await fetch(apiUrl, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${this.token}`,
          "Content-Type": "application/json",
          "Accept": "application/vnd.github.v3+json"
        },
        body: JSON.stringify(bodyPayload)
      });

      if (!putRes.ok) {
        const errText = await putRes.text();
        throw new Error(`GitHub Commit Failed (${putRes.status}): ${errText}`);
      }

      console.log(`Successfully committed ${pathInRepo} to GitHub repo ${this.repoOwner}/${this.repoName}!`);
      return true;

    } catch (err) {
      console.warn("GitHub API Commit Warning:", err.message);
      return false;
    }
  }

  /**
   * Fetch latest repository JSON file
   */
  async fetchRepoJson(pathInRepo) {
    try {
      const res = await fetch(`${pathInRepo}?t=${Date.now()}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }
}
