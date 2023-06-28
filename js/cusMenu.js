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
getCurrentFeature()