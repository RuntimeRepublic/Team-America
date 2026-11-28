# Write a letter

Open letters stay in this repository. Personal letters you don't want open belong in your own private repo, not here.

## Steps

1. You need a member file in `members/`.
2. Pick an open card. Paste the card link into your own AI with the starter prompt from [AI-RULES.md](AI-RULES.md).
3. Your AI writes a **fresh** letter in your words with your details. Don't copy another member's letter.
4. Print, sign and photograph it. Seal and stamp it, then photograph the envelope.
5. Upload the three files into your folder (GitHub web: Add file → Upload files) and open a PR.
6. When a reply comes, add it the same way.

The three files in step 5 are `letter.md`, `letter.jpg` and `envelope.jpg`. The folder also needs `meta.yml`, described below, or the letter is not listed in the log.

Warning: the photos show your name and signature, and often your home address. Crop them if you don't want that public.

## Where the files go

One folder per card, member and office:

```
letters/LTR-####/<github-username>/<office-slug>/
    letter.md
    letter.jpg
    envelope.jpg
    reply.md
    reply.jpg
    meta.yml
```

`letter.md` is the text as mailed, including the footer from [AI-RULES.md](AI-RULES.md). `letter.jpg` is the photo of the signed letter. `envelope.jpg` is the photo of the sealed, stamped envelope. `reply.md` and `reply.jpg` are added when a reply arrives.

Office slugs look like `us-house-ks-04`, `us-senate-ks-<lastname>` or `agency-ssa-foia`.

`meta.yml` keys:

| Key | Meaning |
|---|---|
| `type` | `Letter`, `FOIA request`, `Open-records request` or `Public comment` |
| `office` | Name of the office, from its official site |
| `state` | Two-letter code such as `KS`, or empty for an agency |
| `district_or_agency` | District or agency name |
| `sent` | Date mailed, `YYYY-MM-DD`, or empty |
| `tracking_no` | FOIA or postal tracking number, or empty |
| `acknowledged` | Date acknowledged, `YYYY-MM-DD`, or empty |
| `reply_received` | Date a reply arrived, `YYYY-MM-DD`, or empty |

A dummy file, not a real letter, is at [letters/LTR-EXAMPLE/example-member/us-house-ks-04/meta.yml](LTR-EXAMPLE/example-member/us-house-ks-04/meta.yml). The letters log skips `LTR-EXAMPLE`.

## Log and office pages

A push that changes `letters/` rebuilds `letters/log.csv` and one page per office. State offices go to `letters/offices/<ST>/<office-slug>.md`. Agencies go to `letters/offices/agencies/<office-slug>.md`. Those files are created only when a letter exists. Do not edit them by hand.
