#!/usr/bin/env node

import * as HTTPS from "https"
import * as DNS from "dns";
import {conf} from "./conf.mjs"
import process from "process";
//import { promisify } from "util";


const log = console.log.bind(console)
//log( "conf", conf )

const port = parseInt( conf.http.port )
const src_domain = conf.source
const ref_domain = conf.reference
const dns = conf.dns

const resolve = DNS.promises.resolve4
const dns_ips = await resolve(dns)

const resolver = new DNS.promises.Resolver()
resolver.setServers(dns_ips)

const is_main = import.meta.url.endsWith(process.argv[1])
if( is_main ){
	const res = await sync_domain_ip({dry:false,verbose:true});
	log(res);
}

export async function sync_domain_ip({dry,force,verbose}={}){
	const [src_ip] = await resolver.resolve4(src_domain)
	//const src_ip = "213.88.136.204";

	const [ref_ip] = await resolver.resolve4(ref_domain)

	if( src_ip === ref_ip ) return "nochg"

	//log("update", ref_ip, "=>", src_ip)
	if(verbose) log({dry,force,ref_ip,src_ip})

	let errcount = 0;

	for( const dyndns of conf.dyndns ){
		const user = dyndns.user
		const pass = dyndns.pass
		const auth = Buffer.from(user + ':' + pass).toString('base64')
		const headers = {
			Authorization: 'Basic ' + auth,
		}
		
		for( const domain of dyndns.domains ){
			const [cur_ip] = await resolver.resolve4(domain)
			if( cur_ip === src_ip ){
				if( verbose ) log("domain", domain, "unchanged")
				continue;
			}
			
			const url = `https://${dyndns.server}?hostname=${domain}&myip=${src_ip}`;
			if( dry && verbose) log("would call", url);
			if( dry ) continue;
			const res = await basic_fetch(url, headers);

			if( verbose && res === "good" ) log(`${user} / ${domain} ${res}`)
			if( res !== "good" ){
				console.error(`${user} / ${domain} ${res}`)
				if( res !== "nochg" ) errcount++
			}
		}
		
	}
	
	if( errcount ) return "911";

	return "good";
}

function basic_fetch( url, headers ){
	return new Promise( (resolve,reject) =>{
		HTTPS.get( url, { headers }, resp =>{
			let data = ''
			resp.on('data', chunk => data += chunk )
			resp.on('end', () => resolve(data) )
		}).on("error", err => reject(err) )
	})
}
