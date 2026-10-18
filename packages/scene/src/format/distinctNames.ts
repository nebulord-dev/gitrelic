// Short names for a set of files that still tell them apart: the basename,
// with just enough parent folders added where two would read the same
// (`client/index.ts`, `server/index.ts`). A name that's unique stays bare.

export function distinctNames(paths: readonly string[]): Map<string, string> {
  const parts = new Map(paths.map((p) => [p, p.split('/')]));
  const depth = new Map(paths.map((p) => [p, 1]));
  const nameOf = (p: string) => {
    const segs = parts.get(p)!;
    return segs.slice(-Math.min(depth.get(p)!, segs.length)).join('/');
  };
  for (;;) {
    const byName = new Map<string, string[]>();
    for (const p of paths) {
      const n = nameOf(p);
      const list = byName.get(n);
      if (list) list.push(p);
      else byName.set(n, [p]);
    }
    let grew = false;
    for (const group of byName.values()) {
      if (group.length < 2) continue;
      for (const p of group) {
        if (depth.get(p)! < parts.get(p)!.length) {
          depth.set(p, depth.get(p)! + 1);
          grew = true;
        }
      }
    }
    if (!grew) break;
  }
  return new Map(paths.map((p) => [p, nameOf(p)]));
}
