use super::*;
use std::path::Path;

#[test]
fn test_raw_sample_decoding() {
    let samples_dir = Path::new("../test-samples/raw");
    if !samples_dir.exists() {
        println!("No test samples found at {}", samples_dir.display());
        return;
    }

    let mut success = 0;
    let mut failed = 0;
    let mut entries: Vec<_> = std::fs::read_dir(samples_dir)
        .unwrap()
        .flatten()
        .map(|e| e.path())
        .filter(|p| is_raw_file(p) || crate::imaging::pro_decoder::is_pro_file(p))
        .collect();
    entries.sort();

    for path in &entries {
        let name = path.file_name().unwrap().to_string_lossy();
        let start = std::time::Instant::now();
        let res = if is_raw_file(path) {
            decode_raw_image(path)
        } else {
            crate::imaging::pro_decoder::decode_pro_image(path)
        };

        match res {
            Ok((data_url, (w, h))) => {
                let elapsed = start.elapsed();
                let b64_len = data_url.len();
                println!("[TEST PASS] {:<42} {:>5}x{:<5} {:>7?} ({} bytes)", name, w, h, elapsed, b64_len);
                success += 1;
            }
            Err(e) => {
                println!("[TEST FAIL] {} -> {}", name, e);
                failed += 1;
            }
        }
    }

    println!("[TEST SUMMARY] {} passed, {} failed out of {} sample files", success, failed, entries.len());
    assert_eq!(failed, 0, "All sample files must decode successfully");
}
