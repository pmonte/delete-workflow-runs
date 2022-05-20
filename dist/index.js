async function run() {
  const core = require("@actions/core");
  try {
    // Fetch all the inputs
    const token = core.getInput('token');
    const repository = core.getInput('repository');
    const retain_days = Number(core.getInput('retain_days'));
    const keep_minimum_runs = Number(core.getInput('keep_minimum_runs'));
    // Split the input 'repository' (format {owner}/{repo}) to be {owner} and {repo}
    const splitRepository = repository.split('/');
    if (splitRepository.length !== 2 || !splitRepository[0] || !splitRepository[1]) {
      throw new Error(`Invalid repository '${repository}'. Expected format {owner}/{repo}.`);
    }
    const repo_owner = splitRepository[0];
    const repo_name = splitRepository[1];
    const { Octokit } = require("@octokit/rest");
    const octokit = new Octokit({ auth: token });
    let runs = await octokit
      .paginate("GET /repos/:owner/:repo/actions/runs", {
        owner: repo_owner,
        repo: repo_name,
      });
    console.log(`ðŸ’¬ found total of ${runs.length} run(s)`);
    let del_runs = new Array();
    let Skip_runs = new Array();
    for (const run of runs) {
        core.debug(`Run: run ${run.id} (status=${run.status})`)
        if (run.status !== "completed") {
          console.log(`ðŸ‘» Skipped run ${run.id}: it is in '${run.status}' state`);
          continue;
        }
        const created_at = new Date(run.created_at);
        const current = new Date();
        const ELAPSE_ms = current.getTime() - created_at.getTime();
        const ELAPSE_days = ELAPSE_ms / (1000 * 3600 * 24);
        if (ELAPSE_days >= retain_days) {
          core.debug(`  Added to del list run ${run.id}`);
          del_runs.push(run);
        }
        //else {
          //console.log(`ðŸ‘» Skipped run ${run.id}: created at ${run.created_at}`);
        //}
	}



      const arr_length = del_runs.length - keep_minimum_runs;
      if (arr_length > 0) {
		console.log(`Ready to delete ${del_runs.length} less keep_minimum_runs runs`);
        del_runs = del_runs.sort((a, b) => { return a.id - b.id; });
        if (keep_minimum_runs !== 0) {
          Skip_runs = del_runs.slice(-keep_minimum_runs);
          del_runs = del_runs.slice(0, -keep_minimum_runs);
          for (const Skipped of Skip_runs) {
            console.log(`ðŸ‘» Skipped run ${Skipped.id}: created at ${Skipped.created_at}`);
          }
        }
        core.debug(`Deleting ${del_runs.length} runs`);
        for (const del of del_runs) {
          core.debug(`Deleting run ${del.id}`);
          // Execute the API "Delete a workflow run", see 'https://octokit.github.io/rest.js/v18#actions-delete-workflow-run'
          await octokit.actions.deleteWorkflowRun({
            owner: repo_owner,
            repo: repo_name,
            run_id: del.id
          });
          console.log(`ðŸš€ Delete run ${del.id}`);
        }
        console.log(`âœ… ${arr_length} runs deleted.`);
      }
	  else {
		  console.log(`arr_length = 0`);
	  }
    }
  catch (error) {
    core.setFailed(error.message);
  }
}

run();
