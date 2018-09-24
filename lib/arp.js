'use strict';

const ARP_HTYPE = 1;
const ARP_PTYPE = 0x800;
const ARP_HLEN = 6;
const ARP_PLEN = 4;

const ARP_REQUEST = 1;
const ARP_REPLY = 2;

const ARP_LEN = (2 * ARP_HLEN) + (2 * ARP_PLEN) + 8;

class ARPPkt extends IHdr {
	fill() {
		this.htype = ARP_HTYPE;
		this.ptype = ARP_PTYPE;
		this.hlen = ARP_HLEN;
		this.plen = ARP_PLEN;
		this.operation = 0;
		this.sha = null;
		this.spa = null;
		this.tha = null;
		this.tpa = null;
	}

	makeReply() {
		if (this.operation !== ARP_REQUEST) {
			return null;
		}
		const replyARP = new ARPPkt(false);
		replyARP.htype = this.htype;
		replyARP.ptype = this.ptype;
		replyARP.hlen = this.hlen;
		replyARP.plen = this.plen;
		replyARP.operation = ARP_REPLY;
		replyARP.sha = ourMac;
		replyARP.spa = this.tpa;
		replyARP.tha = this.sha;
		replyARP.tpa = this.spa;
		return replyARP;
	}

	static fromPacket(packet, offset) {
		const arp = new ARPPkt(false);
		const data = new Uint8Array(packet, offset);
		arp.htype = data[1] + (data[0] << 8);
		arp.ptype = data[3] + (data[2] << 8);
		arp.hlen = data[4];
		arp.plen = data[5];
		arp.operation = data[7] + (data[6] << 8);
		arp.sha = MACAddr.fromByteArray(data, 8);
		arp.spa = IPAddr.fromByteArray(data, 14);
		arp.tha = MACAddr.fromByteArray(data, 18);
		arp.tpa = IPAddr.fromByteArray(data, 24);
		return arp;
	}

	toPacket(array, offset) {
		const packet = new Uint8Array(array, offset, ARP_LEN);

		packet[0] = (this.htype >>> 8) & 0xFF;
		packet[1] = this.htype & 0xFF;
		packet[2] = (this.ptype >>> 8) & 0xFF;
		packet[3] = this.ptype & 0xFF;
		packet[4] = this.hlen;
		packet[5] = this.plen;
		packet[6] = (this.operation >>> 8) & 0xFF;
		packet[7] = this.operation & 0xFF;

		this.sha.toBytes(packet, 8);
		this.spa.toBytes(packet, 14);
		this.tha.toBytes(packet, 18);
		this.tpa.toBytes(packet, 24);

		return ARP_LEN;
	}
}