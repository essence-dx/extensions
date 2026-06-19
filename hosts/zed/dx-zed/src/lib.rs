mod command_plans;

use command_plans::command_plan_for;
use zed_extension_api::{
    self as zed, SlashCommand, SlashCommandArgumentCompletion, SlashCommandOutput,
    SlashCommandOutputSection, Worktree,
};

struct DxZedExtension;

impl zed::Extension for DxZedExtension {
    fn new() -> Self {
        Self
    }

    fn run_slash_command(
        &self,
        command: SlashCommand,
        args: Vec<String>,
        _worktree: Option<&Worktree>,
    ) -> zed::Result<SlashCommandOutput> {
        let Some(plan) = command_plan_for(command.name.as_str()) else {
            return Err(format!("unsupported DX Zed slash command: {}", command.name));
        };

        let argument_note = if args.is_empty() {
            "Arguments: none."
        } else {
            "Arguments captured for review."
        };
        let proof_note = if plan.requires_runtime_proof {
            "Runtime: DX service connection is not configured for this host."
        } else {
            "Runtime: command plan is available."
        };
        let text = format!(
            "Command: {label}\nOperation: {operation}\nTransport: {transport}\n{argument_note}\n{proof_note}",
            label = plan.label,
            operation = plan.operation,
            transport = plan.transport,
            argument_note = argument_note,
            proof_note = proof_note
        );
        let text_len = text.len();

        Ok(SlashCommandOutput {
            sections: vec![SlashCommandOutputSection {
                range: (0..text_len).into(),
                label: plan.label.to_string(),
            }],
            text,
        })
    }

    fn complete_slash_command_argument(
        &self,
        _command: SlashCommand,
        _args: Vec<String>,
    ) -> zed::Result<Vec<SlashCommandArgumentCompletion>> {
        Ok(vec![])
    }
}

zed::register_extension!(DxZedExtension);
