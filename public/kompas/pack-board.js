/* Ready Role and Category cards. A seeded subject is not a session until Start. */
(function (root) {
  function order(saved, packs, lane) {
    var mine = (saved || []).filter(function (s) { return s && s.lane === lane; });
    var taken = {};
    mine.forEach(function (s) { if (s.packId) taken[s.packId] = true; });
    var seeds = (packs || []).filter(function (p) { return p && p.kind === lane && !taken[p.id]; }).map(function (p) {
      return {
        seeded: true,
        id: "seed:" + p.id,
        lane: p.kind,
        packId: p.id,
        role: p.title,
        company: "Practice",
        interviewer: "engineer",
        difficulty: "standard",
        createdAt: 0,
        mustMention: p.mustMention || [],
        jd: p.dossier || "",
        notebookLmUrl: p.notebookLmUrl || "",
        pack: p,
      };
    });
    function rank(s) {
      if (s.runAt && !s.endedAt) return 0;
      if (s.seeded) return 1;
      if (s.endedAt) return 3;
      return 2;
    }
    var seedAt = {};
    seeds.forEach(function (s, i) { seedAt[s.packId] = i; });
    return mine.concat(seeds).sort(function (a, b) {
      var d = rank(a) - rank(b);
      if (d) return d;
      if (a.seeded && b.seeded) return seedAt[a.packId] - seedAt[b.packId];
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }

  root.KompasPackBoard = { order: order };
})(typeof globalThis !== "undefined" ? globalThis : window);
