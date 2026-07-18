/**
 * Public GitLab project that hosts ARC release artifacts (installers + latest.yml).
 * Not a full source mirror of GitHub — releases only.
 *
 * After creating the project, set `projectId` to the numeric Project ID
 * (Settings → General) or to `namespace/path` (e.g. `A.Lavrenuk/arc-releases`).
 * Client must not need a token — project visibility: Public.
 */
export const ARC_GITLAB_RELEASES_HOST = 'gitlab.com' as const;

/** Numeric Project ID: https://gitlab.com/ides07/arc */
export const ARC_GITLAB_RELEASES_PROJECT_ID: string | number = 84578247;

export const ARC_GITLAB_RELEASES_V_PREFIXED_TAG = false;

export function arcGitlabReleaseFeedOptions(): {
  provider: 'gitlab';
  host: string;
  projectId: string | number;
  vPrefixedTagName: boolean;
} {
  return {
    provider: 'gitlab',
    host: ARC_GITLAB_RELEASES_HOST,
    projectId: ARC_GITLAB_RELEASES_PROJECT_ID,
    vPrefixedTagName: ARC_GITLAB_RELEASES_V_PREFIXED_TAG
  };
}
