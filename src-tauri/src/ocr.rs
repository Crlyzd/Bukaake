/**
 * Bukaake Native Windows OCR Engine
 * Hardware-accelerated offline text recognition using Windows.Media.Ocr (< 180 lines)
 */

use serde::Serialize;
use base64::Engine;

#[derive(Serialize)]
pub struct OcrResultPayload {
    pub text: String,
    pub lines: Vec<String>,
    pub word_count: usize,
    pub line_count: usize,
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn extract_text_from_image(base64_data: String) -> Result<OcrResultPayload, String> {
    use windows::Storage::Streams::{DataWriter, InMemoryRandomAccessStream};
    use windows::Graphics::Imaging::BitmapDecoder;
    use windows::Media::Ocr::OcrEngine;

    let clean_b64 = if let Some(idx) = base64_data.find(',') {
        &base64_data[idx + 1..]
    } else {
        &base64_data
    };

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(clean_b64)
        .map_err(|e| format!("Base64 decode failed: {}", e))?;

    if bytes.is_empty() {
        return Err("Cannot extract text from empty image payload".into());
    }

    let result = (|| -> windows::core::Result<OcrResultPayload> {
        let stream = InMemoryRandomAccessStream::new()?;
        let writer = DataWriter::CreateDataWriter(&stream)?;
        writer.WriteBytes(&bytes)?;
        writer.StoreAsync()?.get()?;
        writer.FlushAsync()?.get()?;
        let _ = writer.DetachStream()?;
        stream.Seek(0)?;

        let decoder = BitmapDecoder::CreateAsync(&stream)?.get()?;
        let bitmap = decoder.GetSoftwareBitmapAsync()?.get()?;

        let engine = OcrEngine::TryCreateFromUserProfileLanguages()?;
        let ocr_result = engine.RecognizeAsync(&bitmap)?.get()?;

        let full_text = ocr_result.Text()?.to_string();
        let lines_collection = ocr_result.Lines()?;
        let mut lines = Vec::new();
        let mut word_count = 0;

        for line in lines_collection {
            let line_text = line.Text()?.to_string();
            let words = line.Words()?;
            word_count += words.Size()? as usize;
            lines.push(line_text);
        }

        let line_count = lines.len();

        Ok(OcrResultPayload {
            text: full_text,
            lines,
            word_count,
            line_count,
        })
    })();

    result.map_err(|e| format!("Windows OCR extraction failed: {}", e))
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn extract_text_from_image(_base64_data: String) -> Result<OcrResultPayload, String> {
    Err("OCR is only supported natively on Windows".into())
}
