# Gravity Goons review gallery

Open `index.html` in a browser. The gallery is self-contained and does not need
the Next.js site or a development server.

## Review workflow

1. Use **Batch** to work through 100 Goons at a time.
2. Open a card to inspect its full-resolution accepted source and assigned traits.
3. Choose **Looks good**, or describe the problem and choose **Save issue**.
4. Use the **Status** filter to return to unreviewed or flagged Goons.
5. Choose **Copy flagged list** to paste the correction queue into Codex, or
   **Download correction list** to save `gravity-goons-corrections.json`.

Review state and notes are stored in the browser's local storage. Use the same
browser on the same computer to retain progress.

Keyboard shortcuts in the full-screen viewer:

- Left/Right Arrow: previous/next Goon
- G: mark as good
- F: focus the issue note
- Escape: close the viewer

## Rebuild after source corrections

```bash
cd /Users/rob/Documents/Codex/gravity-goons
.venv/bin/python scripts/build_review_gallery.py
```

The builder uses the same accepted-source precedence as
`scripts/validate_static_production.py` and only rebuilds thumbnails whose
effective source image changed.
