#!/usr/bin/env python3
"""
Enhanced work hour tracking script with activity bridging and Copilot Chat integration.

Features:
- Activity Bridging: Combines commits, PR conversations, issue comments, and review comments
- 3-Hour Gap Threshold: Only gaps >= 3 hours are treated as breaks
- Copilot Chat Integration: Tracks all GitHub interactions, not just commits
- Editable CSV Format: Users can manually edit work hours and notes
- Manual Edit Preservation: User modifications are preserved across script runs
"""

import os
import csv
from datetime import datetime, timedelta
from collections import defaultdict
from github import Github
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Initialize GitHub API
g = Github(os.environ['GITHUB_TOKEN'])
repo = g.get_repo('stipsitzm/OpenFarmPlanner')

# Configuration
GAP_THRESHOLD_HOURS = 3  # Gaps >= 3 hours are considered breaks
MIN_SESSION_DURATION_HOURS = 0.5  # Minimum duration for a work session
LUNCH_BREAK_THRESHOLD_HOURS = 5  # Sessions >= 5 hours get 1 hour lunch break deducted
LUNCH_BREAK_DURATION_HOURS = 1  # Duration of automatic lunch break


def is_manually_edited(value):
    """
    Check if a manual edit flag is set to true.
    
    Args:
        value: The value to check (e.g., 'Yes', 'true', '1', 'x')
        
    Returns:
        bool: True if the value indicates manual edit
    """
    if not value:
        return False
    return str(value).lower() in ['yes', 'true', '1', 'x']


def get_all_activities():
    """
    Fetch all activities from GitHub: commits, PR comments, issue comments, and review comments.
    
    Returns:
        list: List of activity dictionaries with the following keys:
            - timestamp (datetime): When the activity occurred
            - type (str): Type of activity ('commit', 'pr_comment', 'issue_comment', 'review', etc.)
            - description (str): Brief description of the activity
    """
    activities = []
    
    print("Fetching commits...")
    commits = repo.get_commits()
    for commit in commits:
        if commit.commit.author.date:
            activities.append({
                'timestamp': commit.commit.author.date,
                'type': 'commit',
                'description': commit.commit.message.split('\n')[0]
            })
    
    print("Fetching pull request comments...")
    pull_requests = repo.get_pulls(state='all')
    for pr in pull_requests:
        # PR creation
        if pr.created_at:
            activities.append({
                'timestamp': pr.created_at,
                'type': 'pr_created',
                'description': f"PR #{pr.number}: {pr.title}"
            })
        
        # PR comments (conversations)
        try:
            for comment in pr.get_issue_comments():
                if comment.created_at:
                    activities.append({
                        'timestamp': comment.created_at,
                        'type': 'pr_comment',
                        'description': f"Comment on PR #{pr.number}"
                    })
                if comment.updated_at and comment.updated_at != comment.created_at:
                    activities.append({
                        'timestamp': comment.updated_at,
                        'type': 'pr_comment_edit',
                        'description': f"Updated comment on PR #{pr.number}"
                    })
        except Exception as e:
            print(f"Warning: Could not fetch comments for PR #{pr.number}: {e}")
        
        # Review comments
        try:
            for review in pr.get_reviews():
                if review.submitted_at:
                    activities.append({
                        'timestamp': review.submitted_at,
                        'type': 'review',
                        'description': f"Review on PR #{pr.number}"
                    })
        except Exception as e:
            print(f"Warning: Could not fetch reviews for PR #{pr.number}: {e}")
        
        try:
            for comment in pr.get_review_comments():
                if comment.created_at:
                    activities.append({
                        'timestamp': comment.created_at,
                        'type': 'review_comment',
                        'description': f"Review comment on PR #{pr.number}"
                    })
                if comment.updated_at and comment.updated_at != comment.created_at:
                    activities.append({
                        'timestamp': comment.updated_at,
                        'type': 'review_comment_edit',
                        'description': f"Updated review comment on PR #{pr.number}"
                    })
        except Exception as e:
            print(f"Warning: Could not fetch review comments for PR #{pr.number}: {e}")
    
    print("Fetching issue comments...")
    issues = repo.get_issues(state='all')
    for issue in issues:
        # Skip pull requests (they appear in issues too)
        if issue.pull_request:
            continue
            
        # Issue creation
        if issue.created_at:
            activities.append({
                'timestamp': issue.created_at,
                'type': 'issue_created',
                'description': f"Issue #{issue.number}: {issue.title}"
            })
        
        # Issue comments
        try:
            for comment in issue.get_comments():
                if comment.created_at:
                    activities.append({
                        'timestamp': comment.created_at,
                        'type': 'issue_comment',
                        'description': f"Comment on issue #{issue.number}"
                    })
                if comment.updated_at and comment.updated_at != comment.created_at:
                    activities.append({
                        'timestamp': comment.updated_at,
                        'type': 'issue_comment_edit',
                        'description': f"Updated comment on issue #{issue.number}"
                    })
        except Exception as e:
            print(f"Warning: Could not fetch comments for issue #{issue.number}: {e}")
    
    print(f"Found {len(activities)} total activities")
    return activities


def merge_activity_timeline(activities):
    """
    Merge activities into work sessions using 3-hour gap threshold.
    
    Activities within 3 hours of each other are considered part of the same session.
    Gaps >= 3 hours are treated as breaks between sessions.
    
    Args:
        activities: List of activity dictionaries
        
    Returns:
        list: List of work session dictionaries
    """
    if not activities:
        return []
    
    # Sort activities by timestamp
    sorted_activities = sorted(activities, key=lambda x: x['timestamp'])
    
    # Group activities by date first
    activities_by_date = defaultdict(list)
    for activity in sorted_activities:
        date = activity['timestamp'].date()
        activities_by_date[date].append(activity)
    
    work_sessions = []
    
    for date, day_activities in sorted(activities_by_date.items()):
        if not day_activities:
            continue
        
        # Sort activities for this day
        day_activities = sorted(day_activities, key=lambda x: x['timestamp'])
        
        # Start first session
        current_session_start = day_activities[0]['timestamp']
        current_session_end = day_activities[0]['timestamp']
        session_activities = [day_activities[0]]
        
        for i in range(1, len(day_activities)):
            activity = day_activities[i]
            time_gap = (activity['timestamp'] - current_session_end).total_seconds() / 3600
            
            if time_gap < GAP_THRESHOLD_HOURS:
                # Activity is within threshold, extend current session
                current_session_end = activity['timestamp']
                session_activities.append(activity)
            else:
                # Gap is too large, close current session and start new one
                work_sessions.append({
                    'date': date,
                    'start': current_session_start,
                    'end': current_session_end,
                    'activities': session_activities
                })
                
                # Start new session
                current_session_start = activity['timestamp']
                current_session_end = activity['timestamp']
                session_activities = [activity]
        
        # Add the last session of the day
        work_sessions.append({
            'date': date,
            'start': current_session_start,
            'end': current_session_end,
            'activities': session_activities
        })
    
    # Calculate durations and extract activity descriptions
    for session in work_sessions:
        duration = (session['end'] - session['start']).total_seconds() / 3600
        
        # Enforce minimum session duration (ensures even single commits count as work)
        # Note: This may show 0.5h even if actual time gap is smaller
        duration = max(MIN_SESSION_DURATION_HOURS, duration)
        
        # Subtract lunch break for long sessions
        lunch_break = 0
        if duration >= LUNCH_BREAK_THRESHOLD_HOURS:
            duration -= LUNCH_BREAK_DURATION_HOURS
            lunch_break = LUNCH_BREAK_DURATION_HOURS
        
        session['duration'] = round(duration, 1)
        session['lunch_break'] = lunch_break
        session['activity'] = extract_activity_description(session['activities'])
    
    return work_sessions


def extract_activity_description(activities):
    """
    Extract a meaningful activity description from a list of activities.
    
    Args:
        activities: List of activity dictionaries
        
    Returns:
        str: Activity description
    """
    if not activities:
        return "Development & Fixes"
    
    # Count activity types
    activity_types = defaultdict(int)
    commit_messages = []
    
    for activity in activities:
        activity_types[activity['type']] += 1
        if activity['type'] == 'commit':
            commit_messages.append(activity['description'])
    
    # Analyze commit messages for keywords
    messages_text = ' '.join(commit_messages).lower() if commit_messages else ''
    
    # Determine primary activity based on commit messages and activity types
    if 'feat' in messages_text or 'add' in messages_text:
        return "Feature Development"
    elif 'fix' in messages_text or 'bug' in messages_text:
        return "Bug Fixes"
    elif 'refactor' in messages_text:
        return "Code Refactoring"
    elif 'test' in messages_text:
        return "Testing"
    elif 'docs' in messages_text or 'documentation' in messages_text:
        return "Documentation"
    elif 'style' in messages_text or 'ui' in messages_text:
        return "UI/UX Design"
    elif 'i18n' in messages_text:
        return "Internationalization"
    elif 'api' in messages_text:
        return "API Integration"
    elif 'migration' in messages_text or 'database' in messages_text:
        return "Database Work"
    elif activity_types['review'] > 0 or activity_types['review_comment'] > 0:
        return "Code Review"
    elif activity_types['pr_comment'] > 0 or activity_types['issue_comment'] > 0:
        return "Discussion & Planning"
    elif activity_types['pr_created'] > 0:
        return "Pull Request Management"
    elif activity_types['issue_created'] > 0:
        return "Issue Management"
    else:
        return "Development & Fixes"


def load_existing_editable_csv(filename='docs/arbeitszeiten_editable.csv'):
    """
    Load existing editable CSV to preserve manual edits.
    
    Args:
        filename: Path to the editable CSV file
        
    Returns:
        dict: Dictionary mapping (date, start) tuples to row data
    """
    manual_entries = {}
    
    if not os.path.exists(filename):
        return manual_entries
    
    try:
        with open(filename, 'r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                if is_manually_edited(row.get('Manually Edited?', '')):
                    # Preserve manually edited entries
                    date = row['Date']
                    start = row['Start']
                    manual_entries[(date, start)] = row
    except Exception as e:
        print(f"Warning: Could not load existing CSV: {e}")
    
    return manual_entries


def generate_editable_csv(work_sessions, filename='docs/arbeitszeiten_editable.csv'):
    """
    Generate editable CSV file with work sessions.
    
    Preserves manual edits from previous runs.
    
    Args:
        work_sessions: List of work session dictionaries
        filename: Path to the output CSV file
    """
    os.makedirs('docs', exist_ok=True)
    
    # Load existing manual entries
    manual_entries = load_existing_editable_csv(filename)
    print(f"Found {len(manual_entries)} manually edited entries to preserve")
    
    with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['Date', 'Start', 'End', 'Duration (h)', 'Activity', 'Notes', 'Manually Edited?']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        
        writer.writeheader()
        
        for session in sorted(work_sessions, key=lambda x: x['date']):
            date_str = session['date'].strftime('%Y-%m-%d')
            start_str = session['start'].strftime('%H:%M')
            
            # Check if this entry was manually edited
            key = (date_str, start_str)
            if key in manual_entries:
                # Use the manually edited entry
                writer.writerow(manual_entries[key])
            else:
                # Use the automatically calculated entry
                writer.writerow({
                    'Date': date_str,
                    'Start': start_str,
                    'End': session['end'].strftime('%H:%M'),
                    'Duration (h)': session['duration'],
                    'Activity': session['activity'],
                    'Notes': '',
                    'Manually Edited?': 'No'
                })


def generate_legacy_csv(work_sessions, filename='docs/arbeitszeiten.csv'):
    """
    Generate legacy CSV format for backwards compatibility.
    
    Args:
        work_sessions: List of work session dictionaries
        filename: Path to the output CSV file
    """
    os.makedirs('docs', exist_ok=True)
    
    with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['Datum', 'Start', 'Ende', 'Dauer (h)', 'Mittagspause (h)', 'Tätigkeit']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        
        writer.writeheader()
        for session in sorted(work_sessions, key=lambda x: x['date']):
            writer.writerow({
                'Datum': session['date'].strftime('%Y-%m-%d'),
                'Start': session['start'].strftime('%H:%M'),
                'Ende': session['end'].strftime('%H:%M'),
                'Dauer (h)': session['duration'],
                'Mittagspause (h)': session['lunch_break'],
                'Tätigkeit': session['activity']
            })


def load_csv_data(filename='docs/arbeitszeiten_editable.csv'):
    """
    Load work sessions from CSV file (source of truth).
    
    Args:
        filename: Path to the CSV file
        
    Returns:
        list: List of work session dictionaries
    """
    sessions = []
    
    if not os.path.exists(filename):
        return sessions
    
    try:
        with open(filename, 'r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            for row in reader:
                try:
                    date = datetime.strptime(row['Date'], '%Y-%m-%d').date()
                    start = datetime.strptime(f"{row['Date']} {row['Start']}", '%Y-%m-%d %H:%M')
                    end = datetime.strptime(f"{row['Date']} {row['End']}", '%Y-%m-%d %H:%M')
                    
                    sessions.append({
                        'date': date,
                        'start': start,
                        'end': end,
                        'duration': float(row['Duration (h)']),
                        'activity': row['Activity'],
                        'notes': row.get('Notes', ''),
                        'manually_edited': row.get('Manually Edited?', 'No')
                    })
                except Exception as e:
                    print(f"Warning: Could not parse row: {row}. Error: {e}")
    except Exception as e:
        print(f"Warning: Could not load CSV: {e}")
    
    return sessions


def generate_markdown(csv_filename='docs/arbeitszeiten_editable.csv'):
    """
    Generate markdown content from CSV file (source of truth).
    
    Args:
        csv_filename: Path to the CSV file
        
    Returns:
        str: Markdown content
    """
    # Load sessions from CSV
    work_sessions = load_csv_data(csv_filename)
    
    if not work_sessions:
        return "# Work Hours OpenFarmPlanner\n\nNo work sessions found.\n"
    
    # Calculate totals by month
    monthly_totals = defaultdict(float)
    for session in work_sessions:
        month_key = session['date'].strftime('%Y-%m')
        monthly_totals[month_key] += session['duration']
    
    total_hours = sum(monthly_totals.values())
    
    # Build markdown content
    md_content = """# Work Hours OpenFarmPlanner

Overview of work hours on the OpenFarmPlanner project based on Git commits and GitHub interactions.

**Note:** This tracking system uses activity bridging with a 3-hour gap threshold. All GitHub activities (commits, PR comments, issue comments, reviews) within 3 hours are considered part of the same work session.

## Detailed Time Tracking

| Date | Start | End | Duration (h) | Activity | Notes |
|------|-------|-----|--------------|----------|-------|
"""
    
    # Add work sessions
    for session in sorted(work_sessions, key=lambda x: x['date']):
        date_str = session['date'].strftime('%Y-%m-%d')
        start_str = session['start'].strftime('%H:%M')
        end_str = session['end'].strftime('%H:%M')
        notes = session.get('notes', '')
        manually_edited = session.get('manually_edited', 'No')
        
        # Format notes display with manual edit indicator
        notes_display = ""
        if notes:
            if is_manually_edited(manually_edited):
                notes_display = f"{notes} *[manually edited]*"
            else:
                notes_display = notes
        elif is_manually_edited(manually_edited):
            notes_display = "*[manually edited]*"
        
        md_content += f"| **{date_str}** | {start_str} | {end_str} | ~{session['duration']} | {session['activity']} | {notes_display} |\n"
    
    # Add monthly summary
    md_content += "\n## Monthly Summary\n\n"
    for month in sorted(monthly_totals.keys()):
        md_content += f"- **{month}**: ~{monthly_totals[month]:.1f}h\n"
    
    # Add total
    md_content += f"\n## Total\n\n**Total: ~{total_hours:.1f} work hours**\n\n"
    
    # Add notes
    md_content += """## Notes

- Times are calculated based on GitHub activity timestamps (commits, PR comments, issue comments, reviews)
- **Activity Bridging**: Activities within 3 hours are considered part of the same work session
- **Automatic Lunch Break**: 1 hour deducted for work sessions >= 5 hours
- **Manual Editing**: You can edit `arbeitszeiten_editable.csv` directly. Set "Manually Edited?" to "Yes" to preserve your changes
- Machine-readable data: see `arbeitszeiten_editable.csv` (primary source) and `arbeitszeiten.csv` (legacy format)
- Automatically generated by GitHub Actions

## How to Manually Edit Work Hours

1. Open `docs/arbeitszeiten_editable.csv`
2. Edit the Duration, Activity, or Notes fields as needed
3. Set "Manually Edited?" to "Yes" for any rows you modify
4. Commit and push your changes
5. The script will preserve your manual edits on the next run

## Last Update

"""
    
    md_content += f"Last updated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}\n\n"
    md_content += "---\n*Automatically generated from repository: stipsitzm/OpenFarmPlanner*\n"
    
    return md_content


def main():
    """Main function to update work hour tracking files."""
    print("=== Enhanced Work Hour Tracking with Activity Bridging ===")
    print(f"Gap threshold: {GAP_THRESHOLD_HOURS} hours")
    print()
    
    print("Step 1: Fetching all activities from GitHub...")
    activities = get_all_activities()
    
    print(f"\nStep 2: Merging activities into work sessions (gap threshold: {GAP_THRESHOLD_HOURS}h)...")
    work_sessions = merge_activity_timeline(activities)
    print(f"Created {len(work_sessions)} work sessions")
    
    print("\nStep 3: Generating editable CSV (preserving manual edits)...")
    generate_editable_csv(work_sessions)
    
    print("Step 4: Generating legacy CSV for backwards compatibility...")
    generate_legacy_csv(work_sessions)
    
    print("Step 5: Generating markdown from CSV (source of truth)...")
    markdown_content = generate_markdown()
    
    print("Step 6: Writing to docs/ARBEITSZEITEN.md...")
    os.makedirs('docs', exist_ok=True)
    with open('docs/ARBEITSZEITEN.md', 'w', encoding='utf-8') as f:
        f.write(markdown_content)
    
    print("\n✅ Work hour tracking files updated successfully!")
    print("   - docs/arbeitszeiten_editable.csv (primary source, editable)")
    print("   - docs/arbeitszeiten.csv (legacy format)")
    print("   - docs/ARBEITSZEITEN.md (generated from CSV)")


if __name__ == '__main__':
    main()
