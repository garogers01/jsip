import { IInterface, INTERFACE_NONE } from "../../interface";
import { IPacket } from "../../ipacket";
import { makeEthIPHdr } from "../arp/stack";
import { ETH_LEN, EthHdr } from "../index";
import { IP_NONE } from "./address";
import { IPHdr } from "./index";
import { getRoute } from "./router";

export function sendIPPacket(ipHdr: IPHdr, payload: IPacket, iface: IInterface) {
    let routeDestIp = ipHdr.daddr;

    let route = getRoute(routeDestIp, iface);
    if (!route) {
        return;
    }

    if (route.router !== IP_NONE) {
        routeDestIp = route.router;
        if (route.iface === INTERFACE_NONE) {
            route = getRoute(routeDestIp, iface);
            if (!route) {
                return;
            }
        }
    }

    if (iface === INTERFACE_NONE) {
        if (route.iface === INTERFACE_NONE) {
            return;
        }
        iface = route.iface;
    }

    if (ipHdr.saddr === IP_NONE) {
        ipHdr.saddr = iface.getIP();
    }

    if (!iface.useEthernet()) {
        _sendIPPacket(ipHdr, payload, iface);
        return;
    }

    makeEthIPHdr(routeDestIp, (ethHdr) => {
        if (!ethHdr) {
            return;
        }
        _sendIPPacket(ipHdr, payload, iface, ethHdr);
    }, iface);
}

function _sendIPPacket(ipHdr: IPHdr, payload: IPacket, iface: IInterface, ethIPHdr?: EthHdr) {
    const fullLength = payload.getFullLength();
    const cOffset = ipHdr.getContentOffset();
    const hdrLen = (ethIPHdr ? ETH_LEN : 0) + cOffset;
    const maxPacketSize = iface.getMTU() - cOffset;

    if (fullLength <= maxPacketSize) {
        ipHdr.setContentLength(fullLength);

        const reply = new ArrayBuffer((ethIPHdr ? ETH_LEN : 0) + ipHdr.getFullLength());

        let offset = 0;
        if (ethIPHdr) {
            offset += ethIPHdr.toPacket(reply, offset);
        }
        offset += ipHdr.toPacket(reply, offset);
        offset += payload.toPacket(reply, offset, ipHdr);

        iface.sendRaw(reply);

        return;
    }

    if (ipHdr.df) {
        throw new Error("Needing to send packet too big for MTU/MSS, but DF set");
    }

    const maxPacketSizeFrag = (maxPacketSize >>> 3) << 3;

    const pieceMax = Math.ceil(fullLength / maxPacketSizeFrag) - 1;
    ipHdr.mf = true;

    const replyPacket = new ArrayBuffer(fullLength);
    payload.toPacket(replyPacket, 0, ipHdr);
    const r8 = new Uint8Array(replyPacket);

    let pktData = new ArrayBuffer(hdrLen + maxPacketSizeFrag);
    let p8 = new Uint8Array(pktData);

    for (let i = 0; i <= pieceMax; i++) {
        const offset = maxPacketSizeFrag * i;
        let pieceLen = maxPacketSizeFrag;
        if (i === pieceMax) {
            ipHdr.mf = false;
            pieceLen = replyPacket.byteLength % maxPacketSizeFrag;
            pktData = new ArrayBuffer(hdrLen + pieceLen);
            p8 = new Uint8Array(pktData);
        }

        ipHdr.fragOffset = offset >>> 3;
        ipHdr.setContentLength(pieceLen);

        if (ethIPHdr) {
            ethIPHdr.toPacket(pktData, 0);
            ipHdr.toPacket(pktData, ETH_LEN);
        } else {
            ipHdr.toPacket(pktData, 0);
        }
        for (let j = 0; j < pieceLen; j++) {
            p8[j + hdrLen] = r8[j + offset];
        }

        iface.sendRaw(pktData);
    }
}
