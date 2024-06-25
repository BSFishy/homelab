use std::env;

use console::{Style, Term};
use log::{Level, LevelFilter, Log};

pub fn setup(log_level: usize) -> Result<(), Box<dyn std::error::Error>> {
    let log_level = env::var("LOG_LEVEL")
        .map(|level| level.to_lowercase())
        .map_or(
            match log_level {
                1 => Ok(Level::Error),
                2 => Ok(Level::Warn),
                3 => Ok(Level::Info),
                4 => Ok(Level::Debug),
                5 => Ok(Level::Trace),
                _ => Err("Invalid log level".to_string()),
            },
            |level| match level.as_str() {
                "trace" => Ok(Level::Trace),
                "debug" => Ok(Level::Debug),
                "warn" | "warning" => Ok(Level::Warn),
                "error" => Ok(Level::Error),
                "info" => Ok(Level::Info),
                _ => Err(format!("Unknown log level {level}")),
            },
        )?;

    let logger = Logger {
        log_level,
        term: Term::stderr(),
    };

    log::set_boxed_logger(Box::new(logger)).map(|()| log::set_max_level(LevelFilter::Trace))?;

    Ok(())
}

struct Logger {
    log_level: Level,
    term: Term,
}

impl Log for Logger {
    fn enabled(&self, metadata: &log::Metadata) -> bool {
        metadata.level() <= self.log_level
    }

    fn log(&self, record: &log::Record) {
        if self.enabled(record.metadata()) {
            let level = record.level();

            let style = Style::new().bold();
            let style = match level {
                Level::Error => style.red(),
                Level::Warn => style.yellow(),
                Level::Info => style.green(),
                Level::Debug => style.blue(),
                Level::Trace => style.magenta(),
            };

            let message = format!("{}", record.args());
            let message = message
                .split('\n')
                .map(|line| format!("{:>6} {}", style.apply_to(level), line))
                .collect::<Vec<_>>()
                .join("\n");

            self.term.write_line(&message).unwrap();
        }
    }

    fn flush(&self) {
        self.term.flush().unwrap();
    }
}
