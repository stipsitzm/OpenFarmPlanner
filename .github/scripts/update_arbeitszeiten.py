#!/usr/bin/env python3
"""
Automated script to update ARBEITSZEITEN.md based on Git commit history.
Analyzes commits from stipsitzm and copilot-swe-agent to track work hours.
"""

import os
from datetime import datetime, timedelta
from collections import defaultdict
from github import Github
from dateutil import parser as date_parser

# Initialize GitHub API
g = Github(os.environ['GITHUB_TOKEN'])
repo = g.get_repo('stipsitzm/OpenFarmPlanner')

def get_commits_by_date():
    """Fetch all commits and group them by date."""
    commits = repo.get_commits()
    commits_by_date = defaultdict(list)
    
    for commit in commits:
        if commit.commit.author.date:
            date = commit.commit.author.date.date()
            commits_by_date[date].append(commit.commit.author.date)
    
    return commits_by_date

def calculate_work_hours(commits_by_date):
    """Calculate work hours based on commit timestamps."""
    work_sessions = []
    
    for date, timestamps in sorted(commits_by_date.items()):
        if not timestamps:
            continue
            
        timestamps = sorted(timestamps)
        start_time = timestamps[0]
        end_time = timestamps[-1]
        
        # Calculate duration in hours
        duration = (end_time - start_time).total_seconds() / 3600
        
        # Minimum 0.5 hours per session, even for single commits
        duration = max(0.5, round(duration, 1))
        
        work_sessions.append({
            'date': date,
            'start': start_time,
            'end': end_time,
            'duration': duration
        })
    
    return work_sessions

def generate_markdown(work_sessions):
    """Generate markdown content for ARBEITSZEITEN.md."""
    
    # Calculate totals by month
    monthly_totals = defaultdict(float)
    for session in work_sessions:
        month_key = session['date'].strftime('%Y-%m')
        monthly_totals[month_key] += session['duration']
    
    total_hours = sum(monthly_totals.values())
    
    # Build markdown content
    md_content = """# Arbeitszeiten OpenFarmPlanner

Übersicht der geleisteten Arbeitsstunden am Projekt OpenFarmPlanner basierend auf Git-Commits und Copilot-Interaktionen.

## Detaillierte Zeiterfassung

| Datum | Start | Ende | Dauer (h) | Aktivität |
|-------|-------|------|-----------|-----------|
"""
    
    # Add work sessions
    for session in sorted(work_sessions, key=lambda x: x['date']):
        date_str = session['date'].strftime('%Y-%m-%d')
        start_str = session['start'].strftime('%H:%M')
        end_str = session['end'].strftime('%H:%M')
        
        # Try to determine activity based on commit messages (simplified)
        activity = "Development & Fixes"
        
        md_content += f"| **{date_str}** | {start_str} | {end_str} | ~{session['duration']} | {activity} |\n"
    
    # Add monthly summary
    md_content += "\n## Zusammenfassung nach Monaten\n\n"
    for month in sorted(monthly_totals.keys()):
        md_content += f"- **{month}**: ~{monthly_totals[month]:.1f}h\n"
    
    # Add total
    md_content += f"\n## Gesamtsumme\n\n**Total: ~{total_hours:.1f} Arbeitsstunden**\n\n"
    
    # Add notes
    md_content += """## Hinweise

- Zeiten sind basierend auf Git-Commit-Timestamps berechnet
- Zwischen Commits können Pausen oder parallele Arbeiten stattgefunden haben
- Wenn Copilot aktiv war, wurde auch am Projekt gearbeitet
- Die tatsächliche Arbeitszeit kann daher etwas höher liegen
- Automatisch generiert durch GitHub Actions

## Letzte Aktualisierung

"""
    
    md_content += f"Stand: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}\n\n"
    md_content += "---\n*Automatisch generiert aus Repository: stipsitzm/OpenFarmPlanner*\n"
    
    return md_content

def main():
    """Main function to update ARBEITSZEITEN.md."""
    print("Fetching commits...")
    commits_by_date = get_commits_by_date()
    
    print(f"Found commits on {len(commits_by_date)} different dates")
    
    print("Calculating work hours...")
    work_sessions = calculate_work_hours(commits_by_date)
    
    print("Generating markdown...")
    markdown_content = generate_markdown(work_sessions)
    
    print("Writing to docs/ARBEITSZEITEN.md...")
    with open('docs/ARBEITSZEITEN.md', 'w', encoding='utf-8') as f:
        f.write(markdown_content)
    
    print("✅ ARBEITSZEITEN.md updated successfully!")

if __name__ == '__main__':
    main()
