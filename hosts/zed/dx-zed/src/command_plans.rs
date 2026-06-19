pub struct DxZedCommandPlan {
    pub slash_command: &'static str,
    pub label: &'static str,
    pub operation: &'static str,
    pub transport: &'static str,
    pub requires_runtime_proof: bool,
}

pub const DX_ZED_COMMAND_PLANS: &[DxZedCommandPlan] = &[
    DxZedCommandPlan {
        slash_command: "dx-status",
        label: "DX Status",
        operation: "dx.status",
        transport: "local-service",
        requires_runtime_proof: true,
    },
    DxZedCommandPlan {
        slash_command: "dx-assets",
        label: "DX Assets",
        operation: "dx.assets.search",
        transport: "local-service",
        requires_runtime_proof: true,
    },
    DxZedCommandPlan {
        slash_command: "dx-receipts",
        label: "DX Receipts",
        operation: "receipt.showPath",
        transport: "host-ui",
        requires_runtime_proof: false,
    },
];

pub fn command_plan_for(slash_command: &str) -> Option<&'static DxZedCommandPlan> {
    DX_ZED_COMMAND_PLANS
        .iter()
        .find(|plan| plan.slash_command == slash_command)
}
