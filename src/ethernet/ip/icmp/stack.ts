import { IPHdr, IPPROTO } from "../index";
import { sendIPPacket } from "../send";
import { registerIpHandler } from "../stack";
import { ICMPPkt } from "./index";

type ICMPHandler = (icmpPkt: ICMPPkt, ipHdr: IPHdr) => void;

const icmpHandlers: { [key: number]: ICMPHandler } = {};

function icmpGotPacket(data: ArrayBuffer, offset: number, len: number, ipHdr: IPHdr) {
    const icmpPkt = ICMPPkt.fromPacket(data, offset, len);

    const handler = icmpHandlers[icmpPkt.type];
    if (handler) {
        handler(icmpPkt, ipHdr);
    }
}

function icmpHandleEchoRequest(icmpPkt: ICMPPkt, ipHdr: IPHdr) {
    const replyIp = ipHdr.makeReply();

    const replyICMP = new ICMPPkt();
    replyICMP.type = 0;
    replyICMP.code = 0;
    replyICMP.rest = icmpPkt.rest;
    replyICMP.data = icmpPkt.data;

    sendIPPacket(replyIp, replyICMP);
}

function registerICMPHandler(type: number, handler: ICMPHandler) {
    icmpHandlers[type] = handler;
}

registerICMPHandler(8, icmpHandleEchoRequest);

registerIpHandler(IPPROTO.ICMP, icmpGotPacket);