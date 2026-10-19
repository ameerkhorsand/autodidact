// Fuzzy search library. It tolerates typos and swapped letters.
(function () {
  var FUZ = {};
  FUZ.norm = function (s) { return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); };
  FUZ.words = function (s) { var n = FUZ.norm(s); return n ? n.split(' ') : []; };
  // Edit distance with swaps of neighbors. Stops early when it passes max.
  FUZ.lev = function (a, b, max) {
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > max) return max + 1;
    var prev2 = null, prev = [], cur, i, j;
    for (j = 0; j <= lb; j++) prev[j] = j;
    for (i = 1; i <= la; i++) {
      cur = [i]; var rowMin = i;
      for (j = 1; j <= lb; j++) {
        var c = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        var v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + c);
        if (i > 1 && j > 1 && a.charAt(i - 1) === b.charAt(j - 2) && a.charAt(i - 2) === b.charAt(j - 1)) v = Math.min(v, prev2[j - 2] + 1);
        cur[j] = v; if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      prev2 = prev; prev = cur;
    }
    return prev[lb];
  };
  // Letters of q appear in w in the same order. Returns the number of skipped letters, or -1.
  FUZ.subseq = function (q, w) {
    var i = 0, gaps = 0, last = -1;
    for (var k = 0; k < w.length && i < q.length; k++) {
      if (w.charAt(k) === q.charAt(i)) { if (last >= 0 && k - last > 1) gaps += k - last - 1; last = k; i++; }
    }
    return i === q.length ? gaps : -1;
  };
  FUZ.tok = function (q, w) {
    if (q === w) return 100;
    if (w.indexOf(q) === 0) return 88 - Math.min(20, w.length - q.length);
    if (q.length >= 3 && w.indexOf(q) > 0) return 62;
    var best = 0, L = q.length, allow = L <= 3 ? 0 : (L <= 5 ? 1 : 2);
    if (allow) {
      var d = FUZ.lev(q, w, allow);
      if (d <= allow) best = Math.max(best, 62 - 16 * d);
      if (w.length > L) {
        for (var n = L - 1; n <= L + 1; n++) {
          if (n >= 3 && n <= w.length) { var d2 = FUZ.lev(q, w.slice(0, n), allow); if (d2 <= allow) best = Math.max(best, 54 - 14 * d2); }
        }
      }
    }
    if (L >= 4 && q.charAt(0) === w.charAt(0)) {
      var g = FUZ.subseq(q, w);
      if (g >= 0 && g <= L) best = Math.max(best, 50 - Math.min(26, g * 2));
    }
    return best;
  };
  // fields: [{w: [words], k: weight}]
  FUZ.prep = function (name, tags, desc, extra, subj) {
    var nw = FUZ.words(name);
    nw.push(nw.join(''));
    return [{ w: nw, k: 1 }, { w: FUZ.words(tags + ' ' + extra), k: 0.85 }, { w: FUZ.words(subj), k: 0.7 }, { w: FUZ.words(desc), k: 0.5 }];
  };
  FUZ.score = function (fields, query) {
    var qs = FUZ.words(query);
    if (!qs.length) return 0;
    var total = 0;
    for (var a = 0; a < qs.length; a++) {
      var best = 0;
      for (var f = 0; f < fields.length; f++) {
        var ws = fields[f].w;
        for (var b = 0; b < ws.length; b++) {
          var t = FUZ.tok(qs[a], ws[b]) * fields[f].k;
          if (t > best) best = t;
        }
      }
      if (best < 24) return 0;
      total += best;
    }
    return total / qs.length + Math.min(8, qs.length * 2);
  };
  window.FUZ = FUZ;
})();
