use clap::Parser;

mod args;
mod bootstrap;
mod cloudflare;
mod config;
mod port_cache;
mod token_cache;
mod tunnel;

fn main() {
    use args::Command;

    let args = args::Args::parse();

    match args.command {
        Command::Bootstrap(args) => bootstrap::bootstrap(args),
    }
}
