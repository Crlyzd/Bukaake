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
struct LineData {
    text: String,
    y_top: f32,
    y_bottom: f32,
    height: f32,
}

#[cfg(target_os = "windows")]
fn format_ocr_lines(lines: &[LineData]) -> String {
    if lines.is_empty() {
        return String::new();
    }
    if lines.len() == 1 {
        return lines[0].text.clone();
    }

    let mut heights: Vec<f32> = lines.iter().map(|l| l.height).collect();
    heights.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let median_height = heights[heights.len() / 2];

    let mut positive_gaps: Vec<f32> = Vec::new();
    for i in 0..lines.len() - 1 {
        let gap = lines[i + 1].y_top - lines[i].y_bottom;
        if gap >= 0.0 {
            positive_gaps.push(gap);
        }
    }
    positive_gaps.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let median_gap = if !positive_gaps.is_empty() {
        positive_gaps[positive_gaps.len() / 2]
    } else {
        0.0
    };

    let mut full_text = String::new();
    for (i, line) in lines.iter().enumerate() {
        if i > 0 {
            let prev = &lines[i - 1];
            let gap = line.y_top - prev.y_bottom;

            // Determine if gap represents a paragraph break (blank line / stanza separation)
            let is_paragraph = if line.y_top < prev.y_bottom - median_height * 0.5 {
                // Out-of-order or multi-column jump
                true
            } else if lines.len() <= 2 {
                gap >= median_height * 0.8
            } else {
                gap > (median_gap + median_height * 0.5) && gap >= median_height * 0.65
            };

            if is_paragraph {
                full_text.push_str("\n\n");
            } else {
                full_text.push('\n');
            }
        }
        full_text.push_str(&line.text);
    }

    full_text
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

        let lines_collection = ocr_result.Lines()?;
        let mut detected_lines = Vec::new();
        let mut raw_lines = Vec::new();
        let mut word_count = 0;

        for line in lines_collection {
            let line_text = line.Text()?.to_string();
            let words = line.Words()?;
            let count = words.Size()? as usize;
            word_count += count;

            let trimmed = line_text.trim();
            if trimmed.is_empty() {
                continue;
            }

            raw_lines.push(line_text.clone());

            let mut y_top = f32::MAX;
            let mut y_bottom = f32::MIN;
            let mut has_rect = false;

            for word in &words {
                if let Ok(rect) = word.BoundingRect() {
                    if rect.Y < y_top {
                        y_top = rect.Y;
                    }
                    if rect.Y + rect.Height > y_bottom {
                        y_bottom = rect.Y + rect.Height;
                    }
                    has_rect = true;
                }
            }

            let (top, bottom, height) = if has_rect && y_bottom > y_top {
                (y_top, y_bottom, (y_bottom - y_top).max(1.0))
            } else {
                (0.0, 16.0, 16.0)
            };

            detected_lines.push(LineData {
                text: line_text,
                y_top: top,
                y_bottom: bottom,
                height,
            });
        }

        let full_text = format_ocr_lines(&detected_lines);
        let line_count = raw_lines.len();

        Ok(OcrResultPayload {
            text: full_text,
            lines: raw_lines,
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
