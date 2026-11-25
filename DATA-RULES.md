# Data rules

This repository is public. It holds group information only.

## Never here

Names, initials, addresses, employers, account numbers, dollar amounts, or any single bill or receipt. A pull request that contains one is not merged; the member fixes it and sends it again.

## What goes where

| Path | Holds | Who writes it |
|---|---|---|
| `packets/<YYYY>-W<ww>/<CallSign>.csv` | One member's weekly packet: call sign, flags, CE levels and impact ratings, governments counted, budget order | The member, by pull request |
| `data/group-counts.csv` | One row per week: team totals and averages only | A team admin, after the week's packets are merged |
| `data/study/` | Study files each member reviewed and pushed by hand | The member |
| `MEMBERS.md` | Members who said yes to being listed, and the team's admins | A team admin |
| `news/goals.md` | Team goals and deadlines | A team admin |
| Team news issues (`news` label) | Wins, findings and issues, by GitHub username | Any member, with the Team news form |
| `members/<login>.md` | One file per member: GitHub username, role, join date, AI used, onboarding issue number | The onboarding bot |

## data/group-counts.csv columns

| Column | Meaning |
|---|---|
| `week` | ISO week, for example `2026-W48` |
| `members` | Members on the team that week |
| `closed_week` | Members who closed the week |
| `pf_level_1` … `pf_level_5` | Members at each personal finance level |
| `ce1_earned` … `ce5_earned` | Members who have earned each Close Encounter level |
| `ce1_impact_avg` … `ce5_impact_avg` | Average impact rating among those members (one decimal) |
| `governments_avg` | Average governments counted (one decimal) |
| `federal_rank_avg`, `state_rank_avg`, `local_rank_avg`, `family_rank_avg` | Average place in the budget order, 1 = paid first (one decimal) |
| `family_first` | Members whose budget puts Family first |

The packet format is in [Formats/TEAM-PACKET.md](https://github.com/RuntimeRepublic/Runtime-Republic-Controls/blob/main/Formats/TEAM-PACKET.md). Rules: Runtime-Republic-Controls CONTROL 07.
