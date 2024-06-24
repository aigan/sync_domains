#!/usr/bin/env node

import * as HTTPS from "https"
import * as DNS from "dns"
import {conf} from "./conf.mjs"
import process from "process"
import { realpath } from 'fs/promises';
import { fileURLToPath } from 'url';

import Child_Process from 'child_process';
import { promisify } from 'util';
const exec = promisify(Child_Process.exec);


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

const invoked = await realpath( process.argv[1]);
const __filename = await realpath(fileURLToPath(import.meta.url));

const is_main = invoked === __filename;

if( is_main ){
	const argv = process.argv.slice(2)
	const params = {}
	//log( argv);
	for( const arg of ['dry','verbose','force'] ){
		params[arg] = argv.includes(arg) || argv.includes('--'+arg);
		//log(`${arg} ${params[arg]}`);
	}
	
	try {
		const res = await sync_domain_ip(params)
		log(res);
	}
	catch( err ){
		if( err.code === "ENOTFOUND" ){
			console.error(`Domain not found: ${err.hostname}`);
		} else {
			throw err;
		}
	}
}

export async function sync_domain_ip({dry,force,verbose}={}){
	//log(`sync_domain ${src_domain}`);
	const [src_ip] = await resolver.resolve4(src_domain)

	if(verbose) log(`Src: ${src_domain} ${src_ip}`);
	
	const [ref_ip] = await resolver.resolve4(ref_domain)
	
	if( verbose) log(`Ref: ${ref_domain} ${ref_ip}`);
	
	if( src_ip === ref_ip && !force ) return "nochg"

	//log("update", ref_ip, "=>", src_ip)
	if(verbose) log({dry,force,ref_ip,src_ip})

	let errcount = 0

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
				continue
			}
			
			const url = `https://${dyndns.server}?hostname=${domain}&myip=${src_ip}&wildcard=NOCHG`
			if( dry && verbose) log("would call", url)
			if( dry ) continue
			const res = await basic_fetch(url, headers)

			if( verbose && res === "good" ) log(`${user} / ${domain} ${res}`)
			if( res !== "good" ){
				console.error(`${user} / ${domain} ${res}`)
				if( res !== "nochg" ) errcount++
			}
		}
		
	}
	
	if( errcount ) return "911"

	return "good"
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

async function uncached_ip(domain) {
  const { stdout } = await exec(`dig +trace +short ${domain}`);
  const lines = stdout.trim().split('\n');
  const lastARecord = lines.reverse().find(line => /^A\s/.test(line));
	if( !lastARecord ) return null;
	return lastARecord.split(' ')[1];
}
