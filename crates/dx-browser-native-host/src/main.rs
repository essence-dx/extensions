fn main() {
    let mut stdin = std::io::stdin().lock();
    let mut stdout = std::io::stdout().lock();

    if let Err(error) = dx_browser_native_host::run_native_host(&mut stdin, &mut stdout) {
        eprintln!("{error}");
        std::process::exit(1);
    }
}
