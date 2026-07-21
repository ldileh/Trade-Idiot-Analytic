// Desktop shell entry: spawn the FastAPI backend on a free 127.0.0.1 port, hand
// that port to the frontend, and make sure the child dies with the app.
use std::net::TcpListener;
use std::sync::Mutex;

use tauri::{Manager, State};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

// Port + the live sidecar handle, shared with the frontend and the exit hook.
struct Backend {
    port: u16,
    child: Mutex<Option<CommandChild>>,
}

// Ask the OS for a free port by binding :0, then release it. The backend binds
// it microseconds later — a race window in theory, fine in practice for a
// single local sidecar. ponytail: good enough; switch to a retry loop only if
// spawns ever collide.
fn free_port() -> u16 {
    TcpListener::bind("127.0.0.1:0")
        .expect("no free port")
        .local_addr()
        .unwrap()
        .port()
}

// The frontend calls this to learn where the backend is listening.
#[tauri::command]
fn backend_port(state: State<'_, Backend>) -> u16 {
    state.port
}

pub fn run() {
    let port = free_port();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .manage(Backend {
            port,
            child: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![backend_port])
        .setup(move |app| {
            // BACKEND_PORT mirrors how the backend is run standalone (AGENTS.md §5),
            // and BACKEND_HOST stays 127.0.0.1 so it's never network-exposed.
            let sidecar = app
                .shell()
                .sidecar("backend")?
                .env("BACKEND_PORT", port.to_string())
                .env("BACKEND_HOST", "127.0.0.1");
            let (_rx, child) = sidecar.spawn()?;
            app.state::<Backend>()
                .child
                .lock()
                .unwrap()
                .replace(child);
            Ok(())
        })
        .on_window_event(|window, event| {
            // Kill the sidecar when the last window closes so no orphan python
            // process is left behind.
            if let tauri::WindowEvent::Destroyed = event {
                if let Some(child) = window.state::<Backend>().child.lock().unwrap().take() {
                    // The one-file PyInstaller sidecar is a bootstrap process that
                    // re-spawns the real uvicorn server as its own child. child.kill()
                    // only terminates the bootstrap, orphaning that grandchild (which
                    // keeps holding the port). taskkill /T tears down the whole tree.
                    #[cfg(windows)]
                    {
                        use std::os::windows::process::CommandExt;
                        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
                        let _ = std::process::Command::new("taskkill")
                            .args(["/F", "/T", "/PID", &child.pid().to_string()])
                            .creation_flags(CREATE_NO_WINDOW)
                            .status();
                    }
                    // macOS/Linux: same tree problem. pkill -P kills the children the
                    // one-file bootstrap spawned; then we kill the bootstrap itself.
                    // ponytail: -P is one level deep, which matches PyInstaller's
                    // bootstrap→server shape; go to a process-group kill only if a
                    // deeper grandchild ever survives.
                    #[cfg(unix)]
                    {
                        let _ = std::process::Command::new("pkill")
                            .args(["-TERM", "-P", &child.pid().to_string()])
                            .status();
                    }
                    let _ = child.kill();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
