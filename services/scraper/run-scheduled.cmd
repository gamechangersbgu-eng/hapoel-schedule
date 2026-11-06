@echo off
rem Runs the scraper and writes to the database. Started twice a day by Task Scheduler.
cd /d "%~dp0..\.."
if not exist services\scraper\out mkdir services\scraper\out
call npx tsx services/scraper/run.ts --write >> services\scraper\out\run.log 2>&1
