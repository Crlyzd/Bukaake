pub mod audio_capture;
pub mod audio_mixer;
pub mod capture_commands;
pub mod ebml_patcher;
pub mod recording_border;
pub mod recording_pill;
pub mod screen_capture;

#[cfg(target_os = "windows")]
pub mod d3d_device;
#[cfg(target_os = "windows")]
pub mod wgc_capture;
#[cfg(target_os = "windows")]
pub mod wmf_writer;
#[cfg(target_os = "windows")]
pub mod native_recorder;
