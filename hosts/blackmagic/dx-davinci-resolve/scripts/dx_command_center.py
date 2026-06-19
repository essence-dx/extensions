DX_DAVINCI_RESOLVE_COMMAND_PLANS = {
    "show_status": {
        "id": "dx.davinci-resolve.show_status",
        "operation": "dx.status",
        "transport": "resolve-script",
        "requires_runtime_proof": True,
        "mutates_resolve_project": False,
    },
    "inspect_project": {
        "id": "dx.davinci-resolve.inspect_project",
        "operation": "resolve.project.inspect",
        "transport": "resolve-script",
        "requires_runtime_proof": True,
        "mutates_resolve_project": False,
    },
    "show_receipts": {
        "id": "dx.davinci-resolve.show_receipts",
        "operation": "receipt.showPath",
        "transport": "host-ui",
        "requires_runtime_proof": False,
        "mutates_resolve_project": False,
    },
}

SERVICE_CONNECTION_MESSAGE = "DX service connection is not configured for this host."
RECEIPT_PATH_MESSAGE = "DX receipt path is available in this host."


def command_plan_for(command_name):
    return DX_DAVINCI_RESOLVE_COMMAND_PLANS.get(command_name)


def format_plan_notice(command_name):
    plan = command_plan_for(command_name)

    if plan is None:
        return "Unknown DX DaVinci Resolve command."

    availability_message = SERVICE_CONNECTION_MESSAGE if plan["requires_runtime_proof"] else RECEIPT_PATH_MESSAGE
    return f"{plan['id']}: {plan['operation']}. {availability_message}"


def main():
    for command_name in DX_DAVINCI_RESOLVE_COMMAND_PLANS:
        print(format_plan_notice(command_name))


if __name__ == "__main__":
    main()
