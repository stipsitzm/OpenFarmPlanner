import os
import json
from datetime import datetime, timedelta
from collections import defaultdict

def calculate_work_hours(commits):
    """Calculate work hours from commits with lunch break deduction."""
    if not commits:
        return 0
    
    # Group commits by date
    commits_by_date = defaultdict(list)
    for commit in commits:
        commit_date = datetime.fromisoformat(commit['date'].replace('Z', '+00:00'))
        date_key = commit_date.date()
        commits_by_date[date_key].append(commit_date)
    
    total_hours = 0
    
    for date, timestamps in commits_by_date.items():
        timestamps.sort()
        start_time = timestamps[0]
        end_time = timestamps[-1]
        
        # Calculate duration in hours
        duration = (end_time - start_time).total_seconds() / 3600
        
        # Subtract 1 hour lunch break for work days >= 5 hours
        if duration >= 5:
            duration -= 1
        
        # Minimum 0.5 hours per session, even for single commits
        duration = max(0.5, round(duration, 1))
        
        total_hours += duration
    
    return round(total_hours, 1)

def main():
    # Get commit data from environment variable
    commits_json = os.environ.get('COMMITS_DATA', '[]')
    commits = json.loads(commits_json)
    
    # Calculate work hours
    work_hours = calculate_work_hours(commits)
    
    # Output the result
    print(f"Total work hours: {work_hours}")
    
    # Set output for GitHub Actions
    with open(os.environ['GITHUB_OUTPUT'], 'a') as f:
        f.write(f"work_hours={work_hours}\n")

if __name__ == "__main__":
    main()
