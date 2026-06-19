DX_DAVINCI_RESOLVE_COMMAND_PLANS = {
  show_status = {
    id = "dx.davinci-resolve.show_status",
    operation = "dx.status",
    transport = "resolve-script",
    requires_runtime_proof = true,
    mutates_resolve_project = false
  },
  inspect_project = {
    id = "dx.davinci-resolve.inspect_project",
    operation = "resolve.project.inspect",
    transport = "resolve-script",
    requires_runtime_proof = true,
    mutates_resolve_project = false
  },
  show_receipts = {
    id = "dx.davinci-resolve.show_receipts",
    operation = "receipt.showPath",
    transport = "host-ui",
    requires_runtime_proof = false,
    mutates_resolve_project = false
  }
}

SERVICE_CONNECTION_MESSAGE = "DX service connection is not configured for this host."
RECEIPT_PATH_MESSAGE = "DX receipt path is available in this host."

function command_plan_for(command_name)
  return DX_DAVINCI_RESOLVE_COMMAND_PLANS[command_name]
end

function format_plan_notice(command_name)
  local plan = command_plan_for(command_name)

  if plan == nil then
    return "Unknown DX DaVinci Resolve command."
  end

  local availability_message = RECEIPT_PATH_MESSAGE
  if plan.requires_runtime_proof then
    availability_message = SERVICE_CONNECTION_MESSAGE
  end

  return plan.id .. ": " .. plan.operation .. ". " .. availability_message
end

for command_name, _ in pairs(DX_DAVINCI_RESOLVE_COMMAND_PLANS) do
  print(format_plan_notice(command_name))
end
