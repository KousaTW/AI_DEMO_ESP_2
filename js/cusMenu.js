//根據 html的檔案名稱 給予 對應的功能 例如home.html 使用 getCurrentFeature()會獲得 Object Detection
const featureMap = new Map([
    ["home", "Object Detection"],
    ["single_tracking", "Single Tracking"],
    ["multi_tracking", "Multi Tracking"],
    ["sound_events", "Sound Events"]
]);

function getCurrentFeature() {
    var filename = window.location.href.substring(window.location.href.lastIndexOf("/") + 1, window.location.href.lastIndexOf("."));
    if (featureMap.has(filename)) {
        return featureMap.get(filename);
    }
    return "";
}