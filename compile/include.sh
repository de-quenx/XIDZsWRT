#!/bin/bash

# check bash version
if (( BASH_VERSINFO[0] < 4 )) || (( BASH_VERSINFO[0] == 4 && BASH_VERSINFO[1] < 3 )); then
    echo "Error This script requires bash version 4.3 or higher for nameref support" >&2
    exit 1
fi

# strict error handling
set -euo pipefail
IFS=$'\n\t'

# setup logging colors
setup_colors() {
    PURPLE="\033[95m"
    BLUE="\033[94m"
    GREEN="\033[92m"
    YELLOW="\033[93m"
    RED="\033[91m"
    RESET="\033[0m"
    STEPS="[${PURPLE} STEPS ${RESET}]"
    INFO="[${BLUE} INFO ${RESET}]"
    SUCCESS="[${GREEN} SUCCESS ${RESET}]"
    WARNING="[${YELLOW} WARNING ${RESET}]"
    ERROR="[${RED} ERROR ${RESET}]"
}
setup_colors

# global configuration
declare -A CONFIG=(
    ["MAX_RETRIES"]=5
    ["RETRY_DELAY"]=2
    ["SPINNER_INTERVAL"]=0.1
    ["DEBUG"]="false"
)

# restore cursor and cleanup jobs on exit
cleanup() {
    printf "\e[?25h"
    jobs -p 2>/dev/null | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT

# uniform logging function
log() {
    local level="$1" message="$2"
    case "$level" in
        "ERROR")   echo -e "${ERROR} $message" >&2 ;;
        "STEPS")   echo -e "${STEPS} $message" ;;
        "WARNING") echo -e "${WARNING} $message" ;;
        "SUCCESS") echo -e "${SUCCESS} $message" ;;
        *)         echo -e "${INFO} $message" ;;
    esac
}

# format error messages with stack trace
error_msg() {
    local msg="$1" line_number=${2:-${BASH_LINENO[0]}}
    echo -e "${ERROR} ${msg} (Line: ${line_number})" >&2
    echo "Call stack:" >&2
    local frame=0
    while caller $frame; do ((frame++)); done >&2
    exit 1
}

# visual loading spinner
spinner() {
    local pid=$1
    local frames=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
    local colors=("\033[31m" "\033[33m" "\033[32m" "\033[36m" "\033[34m" "\033[35m")
    printf "\e[?25l"
    while kill -0 "$pid" 2>/dev/null; do
        for ((i=0; i < ${#frames[@]}; i++)); do
            printf "\r ${colors[i]}%s${RESET}" "${frames[i]}"
            sleep "${CONFIG[SPINNER_INTERVAL]}"
        done
    done
    printf "\e[?25h"
    wait "$pid"
    return $?
}

# execute commands with spinner
cmdinstall() {
    local cmd="$1" desc="${2:-$cmd}"
    log "INFO" "Installing $desc"
    ( eval "$cmd" ) &
    spinner "$!"
    local exit_code=$?
    if [[ $exit_code -eq 0 ]]; then
        log "SUCCESS" "Installed $desc"
        if [[ "${CONFIG[DEBUG]}" == "true" ]]; then set -x; fi
    else
        error_msg "Failed to install $desc"
    fi
}

# verify system dependencies
check_dependencies() {
    local -A dependencies=(
        ["aria2"]="aria2c --version | head -n1 | grep -oE '[0-9]+(\.[0-9]+)+'"
        ["curl"]="curl --version | head -n1 | grep -oE '[0-9]+(\.[0-9]+)+'"
        ["tar"]="tar --version | head -n1 | grep -oE '[0-9]+(\.[0-9]+)+'"
        ["gzip"]="gzip --version | head -n1 | grep -oE '[0-9]+(\.[0-9]+)+'"
        ["unzip"]="unzip -v | head -n1 | grep -oE '[0-9]+(\.[0-9]+)+'"
        ["git"]="git --version | head -n1 | grep -oE '[0-9]+(\.[0-9]+)+'"
        ["wget"]="wget --version | head -n1 | grep -oE '[0-9]+(\.[0-9]+)+'"
        ["jq"]="jq --version | grep -oE '[0-9]+(\.[0-9]+)+'"
    )
    log "STEPS" "Checking system dependencies"
    if ! command -v apt-get >/dev/null 2>&1; then
        error_msg "apt-get not found"
    fi
    if ! sudo apt-get update -qq &>/dev/null; then
        error_msg "Failed to update package lists"
    fi
    for pkg in "${!dependencies[@]}"; do
        local version_cmd="${dependencies[$pkg]}" installed_version=""
        if command -v "$pkg" >/dev/null 2>&1; then
            installed_version=$(eval "$version_cmd" 2>/dev/null || echo "")
            if [[ -n "$installed_version" ]]; then
                log "SUCCESS" "Found $pkg version $installed_version"
                continue
            fi
        fi
        log "WARNING" "Installing $pkg"
        if ! sudo apt-get install -y "$pkg" &>/dev/null; then
            error_msg "Failed to install $pkg"
        fi
        installed_version=$(eval "$version_cmd" 2>/dev/null || echo "")
        if [[ -n "$installed_version" ]]; then
            log "SUCCESS" "Installed $pkg version $installed_version"
        else
            log "WARNING" "Installed $pkg but version check failed"
        fi
    done
    log "SUCCESS" "Dependencies satisfied"
}

# determine file extension based on firmware version
get_package_extension() {
    local version="${1:-24.10}"
    local fw_version=$(echo "$version" | cut -d'.' -f1)
    if [[ "$fw_version" -ge 25 ]]; then
        echo "apk"
    else
        echo "ipk"
    fi
}

# download files using aria2c with retries
ariadl() {
    if [ "$#" -lt 1 ]; then error_msg "Usage ariadl <URL> [OUTPUT_FILE]"; fi
    log "STEPS" "Aria2 Downloader"
    local URL=$1 OUTPUT_FILE="" OUTPUT_DIR="" RETRY_COUNT=0
    local MAX_RETRIES=${CONFIG[MAX_RETRIES]} RETRY_DELAY=${CONFIG[RETRY_DELAY]}
    if [ "$#" -eq 1 ]; then
        OUTPUT_FILE=$(basename "$URL")
        OUTPUT_DIR="."
    else
        OUTPUT_FILE=$(basename "$2")
        OUTPUT_DIR=$(dirname "$2")
    fi
    if [ ! -d "$OUTPUT_DIR" ]; then mkdir -p "$OUTPUT_DIR"; fi
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        log "INFO" "Downloading $URL (Attempt $((RETRY_COUNT + 1))/$MAX_RETRIES)"
        if [ -f "$OUTPUT_DIR/$OUTPUT_FILE" ]; then rm -f "$OUTPUT_DIR/$OUTPUT_FILE"; fi
        if aria2c -q -d "$OUTPUT_DIR" -o "$OUTPUT_FILE" "$URL"; then
            return 0
        fi
        RETRY_COUNT=$((RETRY_COUNT + 1))
        if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
            log "WARNING" "Download failed retrying"
            sleep "$RETRY_DELAY"
        fi
    done
    log "ERROR" "Failed to download $OUTPUT_FILE after $MAX_RETRIES attempts"
    return 1
}

# fetch multiple packages dynamically adjusting prefix separator
download_packages() {
    local -n package_list="$1"
    local download_dir="packages"
    local pkg_ext=$(get_package_extension "${VEROP:-24.10}")
    mkdir -p "$download_dir"
    
    # process package list
    for entry in "${package_list[@]}"; do
        IFS="|" read -r pkg_name base_url <<< "$entry"
        unset IFS
        [[ -z "$pkg_name" || -z "$base_url" ]] && continue
        
        # dynamic package prefix logic
        local pkg_prefix="${pkg_name}_"
        [[ "$pkg_ext" == "apk" ]] && pkg_prefix="${pkg_name}-"
        
        local download_url=""
        
        # github api release parser
        if [[ "$base_url" == *"api.github.com"* ]]; then
            local file_urls=$(curl -sL "$base_url" | jq -r '.assets[].browser_download_url' 2>/dev/null || echo "")
            download_url=$(echo "$file_urls" | grep -E "\.${pkg_ext}$" | grep -iE "${pkg_prefix}" | sort -V | tail -1)
            
            # fallback to ipk for older openwrt
            if [[ -z "$download_url" && "$pkg_ext" == "apk" ]]; then
                pkg_prefix="${pkg_name}_"
                download_url=$(echo "$file_urls" | grep -E "\.ipk$" | grep -iE "${pkg_prefix}" | sort -V | tail -1)
            fi
        else
            # direct url web scraper
            local page_content=$(curl -sL --max-time 30 --retry 3 --retry-delay 2 "$base_url" || echo "")
            
            local patterns=("${pkg_prefix}[^\"]*\\.${pkg_ext}" "${pkg_name}\\.${pkg_ext}")
            for pattern in "${patterns[@]}"; do
                download_url=$(echo "$page_content" | grep -oE "\"${pattern}\"" | tr -d '"' | sort -V | tail -n 1 || true)
                [[ -n "$download_url" ]] && break
            done
            
            # fallback to ipk
            if [[ -z "$download_url" && "$pkg_ext" == "apk" ]]; then
                pkg_prefix="${pkg_name}_"
                local fallback_patterns=("${pkg_prefix}[^\"]*\\.ipk" "${pkg_name}\\.ipk")
                for pattern in "${fallback_patterns[@]}"; do
                    download_url=$(echo "$page_content" | grep -oE "\"${pattern}\"" | tr -d '"' | sort -V | tail -n 1 || true)
                    [[ -n "$download_url" ]] && break
                done
            fi
            
            # absolute url formatting
            if [[ -n "$download_url" && ! "$download_url" =~ ^https?:// ]]; then
                download_url="${base_url%/}/$download_url"
            fi
        fi
        
        if [[ -z "$download_url" ]]; then
            log "ERROR" "No package found for $pkg_name (.$pkg_ext)"
            continue
        fi
        
        local output_file="$download_dir/$(basename "$download_url")"
        if ! ariadl "$download_url" "$output_file"; then
            log "ERROR" "Failed to download $pkg_name"
        fi
    done
    return 0
}
