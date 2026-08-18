import type { CardAnnotationV1 } from '@arc-main-shared/detailCardTemplate';

export const ANNOTATION_CLUSTER_DIST = 0.032;

export type AnnotationClusterMember = {
  annot: CardAnnotationV1;
  index: number;
};

export type AnnotationCluster = {
  key: string;
  members: AnnotationClusterMember[];
  x: number;
  y: number;
};

export function annotAnchor(annot: CardAnnotationV1): { x: number; y: number } {
  return { x: annot.x, y: annot.y };
}

export function clusterAnnotations(members: AnnotationClusterMember[]): AnnotationCluster[] {
  const clusters: AnnotationCluster[] = [];
  for (const member of members) {
    const anchor = annotAnchor(member.annot);
    let placed = false;
    for (const cluster of clusters) {
      const dx = cluster.x - anchor.x;
      const dy = cluster.y - anchor.y;
      if (Math.hypot(dx, dy) <= ANNOTATION_CLUSTER_DIST) {
        cluster.members.push(member);
        const n = cluster.members.length;
        cluster.x = cluster.members.reduce((sum, item) => sum + annotAnchor(item.annot).x, 0) / n;
        cluster.y = cluster.members.reduce((sum, item) => sum + annotAnchor(item.annot).y, 0) / n;
        placed = true;
        break;
      }
    }
    if (!placed) {
      clusters.push({
        key: member.annot.id,
        members: [member],
        x: anchor.x,
        y: anchor.y
      });
    }
  }
  return clusters;
}
