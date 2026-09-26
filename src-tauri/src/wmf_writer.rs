/**
 * Bukaake Windows Media Foundation (WMF) Hardware Writer
 * Zero-copy Direct3D surface to H.264 & WASAPI PCM to AAC MP4 SinkWriter (< 260 lines)
 */

use windows::core::{Interface, Result, PCWSTR};
use windows::Win32::Graphics::Direct3D11::ID3D11Texture2D;
use windows::Win32::Media::MediaFoundation::{
    MFCreateAttributes, MFCreateDXGISurfaceBuffer, MFCreateMediaType,
    MFCreateMemoryBuffer, MFCreateSample, MFCreateSinkWriterFromURL,
    MFShutdown, MFStartup, IMFAttributes, IMFMediaBuffer, IMFSample, IMFSinkWriter,
    MFAudioFormat_AAC, MFAudioFormat_PCM, MFMediaType_Audio, MFMediaType_Video,
    MFVideoFormat_H264, MFVideoFormat_RGB32, MFVideoInterlace_Progressive,
    MF_LOW_LATENCY, MF_MT_AUDIO_AVG_BYTES_PER_SECOND, MF_MT_AUDIO_BITS_PER_SAMPLE,
    MF_MT_AUDIO_BLOCK_ALIGNMENT, MF_MT_AUDIO_NUM_CHANNELS, MF_MT_AUDIO_SAMPLES_PER_SECOND,
    MF_MT_AVG_BITRATE, MF_MT_FRAME_RATE, MF_MT_FRAME_SIZE, MF_MT_INTERLACE_MODE,
    MF_MT_MAJOR_TYPE, MF_MT_PIXEL_ASPECT_RATIO, MF_MT_SUBTYPE,
    MF_READWRITE_ENABLE_HARDWARE_TRANSFORMS, MF_SINK_WRITER_DISABLE_THROTTLING,
    MF_SINK_WRITER_D3D_MANAGER, MFSTARTUP_NOSOCKET, MF_VERSION,
};
use std::path::Path;
use crate::d3d_device::D3DContext;

#[inline]
fn pack_u32_pair(high: u32, low: u32) -> u64 {
    ((high as u64) << 32) | (low as u64)
}

pub struct WmfWriter {
    sink_writer: IMFSinkWriter,
    video_stream_idx: u32,
    audio_stream_idx: Option<u32>,
    frame_duration_100ns: i64,
}

unsafe impl Send for WmfWriter {}
unsafe impl Sync for WmfWriter {}

impl WmfWriter {
    pub fn new(
        d3d: &D3DContext,
        out_path: &Path,
        width: u32,
        height: u32,
        fps: u32,
        bitrate: u32,
        include_audio: bool,
    ) -> Result<Self> {
        unsafe {
            MFStartup(MF_VERSION, MFSTARTUP_NOSOCKET)?;
        }

        // 1. Configure Writer Attributes (Hardware MFT + D3D11 Manager + Low Latency)
        let mut attr: Option<IMFAttributes> = None;
        unsafe {
            MFCreateAttributes(&mut attr, 4)?;
        }
        let attr = attr.expect("Failed to create WMF attributes");
        unsafe {
            attr.SetUINT32(&MF_READWRITE_ENABLE_HARDWARE_TRANSFORMS, 1)?;
            attr.SetUINT32(&MF_SINK_WRITER_DISABLE_THROTTLING, 1)?;
            attr.SetUINT32(&MF_LOW_LATENCY, 1)?;
            attr.SetUnknown(&MF_SINK_WRITER_D3D_MANAGER, &d3d.dxgi_manager)?;
        }

        // 2. Instantiate IMFSinkWriter from target file path
        let path_wide: Vec<u16> = out_path
            .as_os_str()
            .to_string_lossy()
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect();
        let sink_writer = unsafe {
            MFCreateSinkWriterFromURL(PCWSTR(path_wide.as_ptr()), None, Some(&attr))?
        };

        // 3. Configure Video Streams (Output: H.264, Input: ARGB32 Direct3D Surface)
        let vid_out = unsafe { MFCreateMediaType()? };
        unsafe {
            vid_out.SetGUID(&MF_MT_MAJOR_TYPE, &MFMediaType_Video)?;
            vid_out.SetGUID(&MF_MT_SUBTYPE, &MFVideoFormat_H264)?;
            vid_out.SetUINT32(&MF_MT_AVG_BITRATE, bitrate)?;
            vid_out.SetUINT32(&MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive.0 as u32)?;
            vid_out.SetUINT64(&MF_MT_FRAME_SIZE, pack_u32_pair(width, height))?;
            vid_out.SetUINT64(&MF_MT_FRAME_RATE, pack_u32_pair(fps, 1))?;
            vid_out.SetUINT64(&MF_MT_PIXEL_ASPECT_RATIO, pack_u32_pair(1, 1))?;
        }
        let video_stream_idx = unsafe { sink_writer.AddStream(&vid_out)? };

        let vid_in = unsafe { MFCreateMediaType()? };
        unsafe {
            vid_in.SetGUID(&MF_MT_MAJOR_TYPE, &MFMediaType_Video)?;
            vid_in.SetGUID(&MF_MT_SUBTYPE, &MFVideoFormat_RGB32)?;
            vid_in.SetUINT32(&MF_MT_INTERLACE_MODE, MFVideoInterlace_Progressive.0 as u32)?;
            vid_in.SetUINT64(&MF_MT_FRAME_SIZE, pack_u32_pair(width, height))?;
            vid_in.SetUINT64(&MF_MT_FRAME_RATE, pack_u32_pair(fps, 1))?;
            vid_in.SetUINT64(&MF_MT_PIXEL_ASPECT_RATIO, pack_u32_pair(1, 1))?;
            sink_writer.SetInputMediaType(video_stream_idx, &vid_in, None)?;
        }

        // 4. Configure Audio Streams (Output: AAC 192kbps, Input: PCM 48kHz Stereo)
        let mut audio_stream_idx: Option<u32> = None;
        if include_audio {
            unsafe {
                if let Ok(aud_out) = MFCreateMediaType() {
                    let _ = aud_out.SetGUID(&MF_MT_MAJOR_TYPE, &MFMediaType_Audio);
                    let _ = aud_out.SetGUID(&MF_MT_SUBTYPE, &MFAudioFormat_AAC);
                    let _ = aud_out.SetUINT32(&MF_MT_AUDIO_NUM_CHANNELS, 2);
                    let _ = aud_out.SetUINT32(&MF_MT_AUDIO_SAMPLES_PER_SECOND, 48_000);
                    let _ = aud_out.SetUINT32(&MF_MT_AUDIO_BITS_PER_SAMPLE, 16);
                    let _ = aud_out.SetUINT32(&MF_MT_AUDIO_AVG_BYTES_PER_SECOND, 24_000);
                    if let Ok(idx) = sink_writer.AddStream(&aud_out) {
                        if let Ok(aud_in) = MFCreateMediaType() {
                            let _ = aud_in.SetGUID(&MF_MT_MAJOR_TYPE, &MFMediaType_Audio);
                            let _ = aud_in.SetGUID(&MF_MT_SUBTYPE, &MFAudioFormat_PCM);
                            let _ = aud_in.SetUINT32(&MF_MT_AUDIO_NUM_CHANNELS, 2);
                            let _ = aud_in.SetUINT32(&MF_MT_AUDIO_SAMPLES_PER_SECOND, 48_000);
                            let _ = aud_in.SetUINT32(&MF_MT_AUDIO_BITS_PER_SAMPLE, 16);
                            let _ = aud_in.SetUINT32(&MF_MT_AUDIO_BLOCK_ALIGNMENT, 4);
                            let _ = aud_in.SetUINT32(&MF_MT_AUDIO_AVG_BYTES_PER_SECOND, 48_000 * 4);
                            if sink_writer.SetInputMediaType(idx, &aud_in, None).is_ok() {
                                audio_stream_idx = Some(idx);
                            }
                        }
                    }
                }
            }
        }

        // 5. Begin Writing session
        unsafe {
            sink_writer.BeginWriting()?;
        }

        let frame_duration_100ns = (10_000_000 / fps.max(1)) as i64;
        Ok(Self {
            sink_writer,
            video_stream_idx,
            audio_stream_idx,
            frame_duration_100ns,
        })
    }

    pub fn write_video_frame(&self, texture: &ID3D11Texture2D, time_100ns: i64) -> Result<()> {
        unsafe {
            let buffer: IMFMediaBuffer = match MFCreateDXGISurfaceBuffer(
                &ID3D11Texture2D::IID,
                texture,
                0,
                false,
            ) {
                Ok(b) => b,
                Err(e) => {
                    eprintln!("[WMF] MFCreateDXGISurfaceBuffer failed: {e}");
                    return Err(e);
                }
            };

            if let Ok(max_len) = buffer.GetMaxLength() {
                let _ = buffer.SetCurrentLength(max_len);
            }

            let sample: IMFSample = MFCreateSample()?;

            sample.AddBuffer(&buffer)?;
            sample.SetSampleTime(time_100ns)?;
            sample.SetSampleDuration(self.frame_duration_100ns)?;

            if let Err(e) = self.sink_writer.WriteSample(self.video_stream_idx, &sample) {
                eprintln!("[WMF] WriteSample failed: {e}");
                return Err(e);
            }
        }
        Ok(())
    }

    pub fn write_audio_pcm(&self, pcm_bytes: &[u8], time_100ns: i64) -> Result<()> {
        let stream_idx = match self.audio_stream_idx {
            Some(idx) => idx,
            None => return Ok(()),
        };

        if pcm_bytes.is_empty() {
            return Ok(());
        }

        unsafe {
            let buffer: IMFMediaBuffer = MFCreateMemoryBuffer(pcm_bytes.len() as u32)?;

            let mut ptr: *mut u8 = std::ptr::null_mut();
            let mut max_len = 0u32;
            let mut cur_len = 0u32;
            buffer.Lock(&mut ptr, Some(&mut max_len), Some(&mut cur_len))?;
            std::ptr::copy_nonoverlapping(pcm_bytes.as_ptr(), ptr, pcm_bytes.len());
            buffer.Unlock()?;
            buffer.SetCurrentLength(pcm_bytes.len() as u32)?;

            let sample: IMFSample = MFCreateSample()?;

            sample.AddBuffer(&buffer)?;
            sample.SetSampleTime(time_100ns)?;

            // 48000 samples/sec * 4 bytes per sample (stereo 16-bit) = 192,000 bytes/sec
            let duration_100ns = (pcm_bytes.len() as i64 * 10_000_000) / 192_000;
            sample.SetSampleDuration(duration_100ns)?;

            self.sink_writer.WriteSample(stream_idx, &sample)?;
        }
        Ok(())
    }

    pub fn finalize(&self) -> Result<()> {
        unsafe {
            self.sink_writer.Finalize()?;
        }
        Ok(())
    }
}

impl Drop for WmfWriter {
    fn drop(&mut self) {
        unsafe {
            let _ = MFShutdown();
        }
    }
}
