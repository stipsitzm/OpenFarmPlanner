# Work Hour Tracking Scripts

This directory contains scripts for tracking work hours on the OpenFarmPlanner project.

## Scripts

### `track_work_hours.py`

Enhanced work hour tracking script with activity bridging and Copilot Chat integration.

**Features:**
- **Activity Bridging**: Combines all GitHub activities (commits, PR comments, issue comments, reviews) into work sessions
- **3-Hour Gap Threshold**: Only gaps ≥ 3 hours between activities are treated as breaks
- **Copilot Chat Integration**: Tracks all GitHub interactions, not just commits
- **Editable CSV Format**: Users can manually edit work hours and notes
- **Manual Edit Preservation**: User modifications are preserved across script runs

**How It Works:**

1. **Fetches all activities** from GitHub:
   - Git commits
   - Pull request comments and conversations
   - Issue comments
   - Code review comments
   - Pull request and issue creation/updates

2. **Merges activities** into work sessions:
   - Activities within 3 hours of each other are grouped into the same session
   - Gaps ≥ 3 hours create a new session (real breaks)
   - Minimum session duration: 0.5 hours
   - Automatic lunch break: 1 hour deducted for sessions ≥ 5 hours

3. **Generates output files**:
   - `docs/arbeitszeiten_editable.csv` - Primary editable source
   - `docs/arbeitszeiten.csv` - Legacy format for backwards compatibility
   - `docs/ARBEITSZEITEN.md` - Human-readable markdown (generated from CSV)

**Usage:**

```bash
# Set GitHub token
export GITHUB_TOKEN="your_github_token"

# Run the script
python .github/scripts/track_work_hours.py
```

**Manual Editing:**

You can manually edit the work hours in `docs/arbeitszeiten_editable.csv`:

1. Open the CSV file
2. Edit Duration, Activity, or Notes as needed
3. Set "Manually Edited?" to "Yes" for modified rows
4. Commit and push changes
5. On the next run, manual edits will be preserved

**Example CSV Format:**

See `example_arbeitszeiten_editable.csv` for the expected format.

### `update_arbeitszeiten.py` (Legacy)

Original script that only tracked commits. **Deprecated** - use `track_work_hours.py` instead.

### `test_track_work_hours.py`

Test suite for the activity bridging logic.

**Run tests:**

```bash
python .github/scripts/test_track_work_hours.py
```

## Configuration

### Gap Threshold

The default gap threshold is 3 hours. You can adjust this in `track_work_hours.py`:

```python
GAP_THRESHOLD_HOURS = 3  # Gaps >= 3 hours are considered breaks
```

### Minimum Session Duration

The minimum session duration is 0.5 hours:

```python
MIN_SESSION_DURATION_HOURS = 0.5  # Minimum duration for a work session
```

## GitHub Actions Workflow

The script runs automatically via GitHub Actions:
- **Schedule**: Every Sunday at 23:00 UTC
- **Manual trigger**: Can be triggered manually via workflow_dispatch

See `.github/workflows/update-arbeitszeiten.yml` for details.

## Examples

### Example 1: Continuous Work Session

Activities:
- 09:00 - Commit
- 10:00 - PR comment
- 12:30 - Code review
- 14:30 - Commit

Result: **1 session** (09:00-14:30, 5.0h) - all gaps < 3 hours

### Example 2: Multiple Sessions

Activities:
- 09:00 - Commit
- 11:00 - Commit
- 15:00 - Commit (4-hour gap)
- 17:00 - PR comment

Result: **2 sessions**
- Session 1: 09:00-11:00 (1.5h)
- Session 2: 15:00-17:00 (1.5h)

The 4-hour gap is treated as a real break.

## Output Files

### `arbeitszeiten_editable.csv`

Primary source of truth. Can be manually edited.

**Columns:**
- Date: YYYY-MM-DD format
- Start: HH:MM format
- End: HH:MM format
- Duration (h): Decimal hours
- Activity: Activity description
- Notes: Optional notes
- Manually Edited?: Yes/No flag

### `arbeitszeiten.csv`

Legacy format for backwards compatibility.

**Columns:**
- Datum: Date in YYYY-MM-DD format
- Start: HH:MM format
- Ende: HH:MM format
- Dauer (h): Decimal hours
- Mittagspause (h): Lunch break hours
- Tätigkeit: Activity description

### `ARBEITSZEITEN.md`

Human-readable markdown report generated from the CSV data.

## Development

### Adding New Activity Types

To add new activity types, modify the `get_all_activities()` function:

```python
def get_all_activities():
    activities = []
    
    # Add new activity type
    for new_activity in repo.get_new_activities():
        activities.append({
            'timestamp': new_activity.created_at,
            'type': 'new_activity_type',
            'description': f"New activity: {new_activity.title}"
        })
    
    return activities
```

### Customizing Activity Descriptions

Modify the `extract_activity_description()` function to customize how activities are categorized.

## License

Same as the main OpenFarmPlanner project.
