use std::fs;
use std::path::{Path, PathBuf};

fn collect_cpp_files(dir: &Path, files: &mut Vec<PathBuf>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                collect_cpp_files(&path, files);
            } else if path.extension().map_or(false, |ext| ext == "cpp") {
                // Skip PhaseOne alternative implementations (_ph.cpp) which conflict with standard routines
                if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                    if file_name.ends_with("_ph.cpp") {
                        continue;
                    }
                }
                files.push(path);
            }
        }
    }
}

fn main() {
    tauri_build::build();

    let vendor_dir = Path::new("vendor/LibRaw");
    let src_dir = vendor_dir.join("src");

    if !src_dir.exists() {
        println!("cargo:warning=LibRaw src directory not found at {}", src_dir.display());
        return;
    }

    let mut cpp_files = Vec::new();
    collect_cpp_files(&src_dir, &mut cpp_files);

    if cpp_files.is_empty() {
        println!("cargo:warning=No LibRaw .cpp files found to compile");
        return;
    }

    let mut build = cc::Build::new();
    build.cpp(true);
    build.include(vendor_dir);
    build.include(vendor_dir.join("internal"));

    for file in &cpp_files {
        build.file(file);
    }

    build.define("WIN32", None);
    build.define("_WIN32", None);
    build.define("LIBRAW_NODLL", None);
    build.define("NO_LCMS", None);

    build.warnings(false);
    build.extra_warnings(false);
    build.flag_if_supported("/MP");
    build.flag_if_supported("/EHsc");
    build.flag_if_supported("/W0");
    build.flag_if_supported("-Wno-unused-result");
    build.flag_if_supported("-Wno-format-truncation");

    build.compile("raw_static");

    println!("cargo:rerun-if-changed=vendor/LibRaw/src");
    println!("cargo:rerun-if-changed=vendor/LibRaw/libraw");
}
