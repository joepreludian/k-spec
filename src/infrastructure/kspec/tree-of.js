
/**
 * Turns a `{ relativePath: content }` map (as `boardToFiles` returns) into the tree
 * `boardFromFiles` reads, without touching a disk. Every file gets `modifiedAt`.
 */
export function treeOf(files, modifiedAt = "2026-01-01T00:00:00.000Z") {
  const tree = { boardYaml: files["board.yaml"] ?? null, lanes: {} };
  for (const [path, content] of Object.entries(files)) {
    const [top, folder, third, fourth, fifth, ...deeper] = path.split("/");
    if (top !== "lanes" || !third) continue;
    const lane = (tree.lanes[folder] ??= { cardsYaml: null, cards: [] });
    if (third === "cards.yaml" && !fourth) {
      lane.cardsYaml = content;
      continue;
    }
    if (!fourth) continue;
    let card = lane.cards.find((c) => c.dir === third);
    if (!card) lane.cards.push((card = { dir: third, cardYaml: null, modifiedAt, files: [] }));
    if (fourth === "card.yaml" && !fifth) card.cardYaml = content;
    else if (fourth === "files" && fifth && deeper.length === 0) card.files.push(fifth);
  }
  return tree;
}

