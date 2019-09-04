import { fromObject } from "data/observable";
import { EventData, Frame, getFrameById, Page, topmost } from "tns-core-modules/ui/frame";
import { GestureEventData } from "tns-core-modules/ui/gestures";
import { SelectedIndexChangedEventData } from "tns-core-modules/ui/tab-view";
import Log from "~/lib/cothority/log";
import { msgFailed } from "~/lib/messages";

export let frame: Frame;

export function navigatingTo(args: EventData) {
    (args.object as Page).bindingContext = fromObject({});
}

export function goPersonhood(args: GestureEventData) {
    frame = args.view.page.frame;
    return frame.navigate({
        moduleName: "pages/lab/personhood/personhood-page",
    });
}

export function goRoPaSci(args: GestureEventData) {
    frame = args.view.page.frame;
    return frame.navigate({
        moduleName: "pages/lab/ropasci/ropasci-page",
    });
}

export function goPoll(args: GestureEventData) {
    frame = args.view.page.frame;
    return frame.navigate({
        moduleName: "pages/lab/poll/poll-page",
    });
}

export async function switchLab(args: SelectedIndexChangedEventData) {
    try {
        if (frame) {
            const ret = await frame.navigate("pages/lab/lab-page");
            frame = null;
            return ret;
        }
    } catch (e) {
        Log.catch(e);
    }
}
