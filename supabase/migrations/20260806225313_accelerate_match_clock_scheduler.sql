select cron.alter_job(
  job_id := (
    select jobid from cron.job
    where jobname = 'gravity-goons-advance-scheduled-matches'
  ),
  schedule := '10 seconds'
);
