#!/usr/bin/env python3
"""
Automated script to update ARBEITSZEITEN.md and arbeitszeiten.csv based on Git commit history.
Analyzes commits from stipsitzm and copilot-swe-agent to track work hours.
Automatically deducts 1 hour lunch break for work days >= 5 hours.
"""

import os
import csv
from datetime import datetime
from collections import defaultdict
from github import Github

# Initialize GitHub API
g = Github(os.environ['GITHUB_TOKEN'])
repo = g.get_repo('stipsitzm/OpenFarmPlanner')

def get_commits_by_date():
    """Fetch all commits and group them by date."""
    commits = repo.get_commits()
    commits_by_date = defaultdict(list)
    commit_messages_by_date = defaultdict(list)
    
    for commit in commits:
        if commit.commit.author.date:
            date = commit.commit.author.date.date()
            commits_by_date[date].append(commit.commit.author.date)
            commit_messages_by_date[date].append(commit.commit.message.split('\n')[0])
    
    return commits_by_date, commit_messages_by_date

def extract_activity(commit_messages):
    """Extract main activity from commit messages."""
    if not commit_messages:
        return "Development & Fixes"
    
    # Analyze commit messages for keywords
    messages_text = ' '.join(commit_messages).lower()
    
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
    else:
        return "Development & Fixes"

def calculate_work_hours(commits_by_date, commit_messages_by_date):
    """Calculate work hours based on commit timestamps with lunch break deduction."""
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
        duration = max(0.5, duration)
        
        # Subtract 1 hour lunch break for work days >= 5 hours
        lunch_break = 0
        if duration >= 5:
            duration -= 1
            lunch_break = 1
        
        duration = round(duration, 1)
        
        # Extract activity description
        activity = extract_activity(commit_messages_by_date[date])
        
        work_sessions.append({
            'date': date,
            'start': start_time,
            'end': end_time,
            'duration': duration,
            'lunch_break': lunch_break,
            'activity': activity
        })
    
    return work_sessions

def generate_csv(work_sessions, filename='docs/arbeitszeiten.csv'):
    """Generate CSV file with work sessions."""
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

| Datum | Start | Ende | Dauer (h) | Tätigkeit |
|-------|-------|------|-----------|-----------|
"""
    
    # Add work sessions
    for session in sorted(work_sessions, key=lambda x: x['date']):
        date_str = session['date'].strftime('%Y-%m-%d')
        start_str = session['start'].strftime('%H:%M')
        end_str = session['end'].strftime('%H:%M')
        
        md_content += f"| **{date_str}** | {start_str} | {end_str} | ~{session['duration']} | {session['activity']} |\n"
    
    # Add monthly summary
    md_content += "\n## Zusammenfassung nach Monaten\n\n"
    for month in sorted(monthly_totals.keys()):
        md_content += f"- **{month}**: ~{monthly_totals[month]:.1f}h\n"
    
    # Add total
    md_content += f"\n## Gesamtsumme\n\n**Total: ~{total_hours:.1f} Arbeitsstunden**\n\n"
    
    # Add notes
    md_content += """## Hinweise

- Zeiten sind basierend auf Git-Commit-Timestamps berechnet
- **Automatischer Abzug: 1 Stunde Mittagspause bei Arbeitstagen >= 5 Stunden**
- Zwischen Commits können Pausen oder parallele Arbeiten stattgefunden haben
- Wenn Copilot aktiv war, wurde auch am Projekt gearbeitet
- Die tatsächliche Arbeitszeit kann daher etwas höher liegen
- Maschinenlesbare Daten: siehe `arbeitszeiten.csv`
- Automatisch generiert durch GitHub Actions

## Stundensatz berechnen

Falls du Spenden erhalten hast, kannst du deinen durchschnittlichen Stundensatz berechnen:

```bash
python .github/scripts/calculate_hourly_rate.py --donations 500
```

## Letzte Aktualisierung

"""
    
    md_content += f"Stand: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}\n\n"
    md_content += "---\n*Automatisch generiert aus Repository: stipsitzm/OpenFarmPlanner*\n"
    
    return md_content

def main():
    """Main function to update ARBEITSZEITEN.md and arbeitszeiten.csv."""
    print("Fetching commits...")
    commits_by_date, commit_messages_by_date = get_commits_by_date()
    
    print(f"Found commits on {len(commits_by_date)} different dates")
    
    print("Calculating work hours (with lunch break deduction for days >= 5h)...")
    work_sessions = calculate_work_hours(commits_by_date, commit_messages_by_date)
    
    print("Generating CSV...")
    generate_csv(work_sessions)
    
    print("Generating markdown...")
    markdown_content = generate_markdown(work_sessions)
    
    print("Writing to docs/ARBEITSZEITEN.md...")
    os.makedirs('docs', exist_ok=True)
    with open('docs/ARBEITSZEITEN.md', 'w', encoding='utf-8') as f:
        f.write(markdown_content)
    
    print("✅ ARBEITSZEITEN.md and arbeitszeiten.csv updated successfully!")

if __name__ == '__main__':
    main()
