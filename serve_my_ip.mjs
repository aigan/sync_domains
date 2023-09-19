#!/usr/bin/env node

import * as HTTP from "http"
import * as DNS from "dns";
import {conf} from "./conf.mjs"

import {sync_domain_ip} from "./sync_domain_ip.mjs"

const log = console.log.bind(console)

//log( "conf", conf )

const port = parseInt( conf.http.port )
const host = conf.source
const dns = conf.dns

const resolve = DNS.promises.resolve4
const dns_ips = await resolve(dns)

const resolver = new DNS.promises.Resolver()
resolver.setServers(dns_ips)

HTTP.createServer(async (req,res)=>{
	const req_ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
	log("req host", req_ip, req.url)

	if( req.url === "/" ){
		const addrs = await resolver.resolve4(host)
		res.write(addrs[0] + "\n" )
	} else if( req.url.startsWith("/nic/update" ) ){
		await update_ip( req, res )
	} else if( req.url.startsWith("/test/update" ) ){
		await update_ip( req, res, {dry:true} )
	} else {
		res.statusCode = 404;
	}
	
	res.end()
}).listen(port)

async function update_ip( req, res, {dry}={} ){
	const verbose = true;

	const authheader = req.headers.authorization
	if( !authheader ) return res.write("badagent\n");

	const [user,pass] = new Buffer.from(authheader.split(' ')[1], 'base64')
				.toString().split(':')
	if( user !== conf.http.user || pass !== conf.http.pass ){
		return res.write("badauth\n")
	}

	try {
		const out = await sync_domain_ip({dry,verbose})
		return res.write(out+"\n")
	} catch( err ){
		res.statusCode = 500;
		console.error( err )
		return res.write(err.message)
	}
}

log("serve_my_ip to", port)
