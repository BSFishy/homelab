use console::{Style, Term};
use log::{Level, LevelFilter, Log};
use std::env;

pub fn setup(log_level: usize) -> Result<(), Box<dyn std::error::Error>> {
    let log_level = match log_level {
        1 => Ok(Level::Error),
        2 => Ok(Level::Warn),
        3 => Ok(Level::Info),
        4 => Ok(Level::Debug),
        5 => Ok(Level::Trace),
        _ => Err("Invalid log level"),
    }?;

    let logger = Logger {
        log_level,
        term: Term::stderr(),
    };

    let max_log_level = match env::var("LOG_LEVEL")
        .unwrap_or("trace".to_string())
        .to_lowercase()
        .as_str()
    {
        "trace" => LevelFilter::Trace,
        "debug" => LevelFilter::Debug,
        "warn" | "warning" => LevelFilter::Warn,
        "error" => LevelFilter::Error,
        "off" => LevelFilter::Off,
        "info" | _ => LevelFilter::Info,
    };

    log::set_boxed_logger(Box::new(logger)).map(|()| log::set_max_level(max_log_level))?;

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

            self.term
                .write_line(&format!("{:>6} {}", style.apply_to(level), record.args()))
                .unwrap();
        }
    }

    fn flush(&self) {
        self.term.flush().unwrap();
    }
}
