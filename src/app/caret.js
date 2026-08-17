// Caret helpers for the editable output box.
//
// Offsets are plain character offsets into the element's textContent, which
// keeps them stable across re-highlighting (the syntax spans come and go, the
// text does not).

// character offset of a DOM position, measured from the start of `root`
function offsetOf(root, container, offset) {
  const range = root.ownerDocument.createRange();
  range.selectNodeContents(root);
  range.setEnd(container, offset);
  return range.toString().length;
}

export function getSelectionOffsets(root) {
  const selection = root.ownerDocument.defaultView.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!root.contains(range.startContainer)) return null;
  return {
    start: offsetOf(root, range.startContainer, range.startOffset),
    end: offsetOf(root, range.endContainer, range.endOffset),
  };
}

// map a character offset back to a DOM position, descending into syntax spans
function locate(root, pos) {
  let remaining = pos;
  let found = null;
  const visit = (node) => {
    if (found) return;
    if (node.nodeType === 3 /* TEXT_NODE */) {
      if (remaining <= node.data.length) found = { node, offset: remaining };
      else remaining -= node.data.length;
      return;
    }
    node.childNodes.forEach(visit);
  };
  visit(root);
  return found ?? { node: root, offset: root.childNodes.length };
}

export function selectRange(root, start, end) {
  const from = locate(root, start);
  const to = locate(root, end);
  const range = root.ownerDocument.createRange();
  range.setStart(from.node, from.offset);
  range.setEnd(to.node, to.offset);
  const selection = root.ownerDocument.defaultView.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}
