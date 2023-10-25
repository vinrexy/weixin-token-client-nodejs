
import Utils from "../../utils";
import { G } from "../../Redis";

// {
//     "code": 0,
//     "data": {
//         "access_token": "72_SpABAfwJ_r_1zQDgntuCQ-xxx",
//         "expires_in": 7054
//     }
// }

class WechatTokenHolder {
    
    public accessTokenInfo: any = null

    private retry:number = 0
    private isFirstRefreshing:boolean = false // lock if accessTokenInfo is null

    public appId:string
    public secret:string

    public constructor(appId:string, secret:string) {
        this.appId = appId
        this.secret = secret
    }

    private async requestAccessToken():Promise<boolean> {
        let appId = this.appId
        let secret = this.secret
        let url = `${G.conf.wxTokenUrl}?wxapp_id=${appId}&secret=${secret}`
        let ret = await Utils.httpGet(url)
        console.log(`requestAccessToken wxapp_id=${appId}&secret=${secret} res=${JSON.stringify( ret && ret.body)}`)
        let retData:any = null
        if (ret && ret.body) {
            retData = JSON.parse(ret.body);
        }
        if(retData && retData.code == 0) {
            this.accessTokenInfo = retData.data
            this.retry = 0
            setTimeout(() => {
                this.requestAccessToken()
            }, this.accessTokenInfo.expires_in * 1000);
            return true
        } else {
            this.retry++
            console.log(`requestAccessToken error ${this.appId} ${this.secret}`)
            if(this.retry > 10){
                console.log(`requestAccessToken fail!!!!! appId=${this.appId}`)
                this.retry = 0
                return false
            } else {
                await Utils.delay(200)
                return this.requestAccessToken()
            }
        }
    }

    private async refreshAccessToken():Promise<void> {
        if(!this.accessTokenInfo) {
            this.isFirstRefreshing = true
        }
        let ret = await this.requestAccessToken()
        this.isFirstRefreshing = false
    }

    private getAccessToken(): any {
        return this.accessTokenInfo && this.accessTokenInfo.access_token
    }

    public async fetchAccessToken(): Promise<any> {
        if(this.isFirstRefreshing) { // lock and delay retry
            await Utils.delay(200)
            return await this.fetchAccessToken()
        }
        if(!this.accessTokenInfo) {
            await this.refreshAccessToken()
        }
        let ret = this.getAccessToken()
        console.log(`fetchAccessToken ret=${ret}`)
        return ret
    }

}

/**
 * 微信 accesstoken 管理中心，被动式进程加锁刷新
 */
export class WechatTokenCenter {

    public static accessTokenInfo: any = null
    public static accessTokenHolders: {[k:string]: WechatTokenHolder} = {}

    public static init() {
    }

    private static createWechatTokenHolder(appId:string, secret:string):WechatTokenHolder {
        let holder = new WechatTokenHolder(appId, secret)
        this.accessTokenHolders[appId] = holder
        return holder
        // await holder.refreshAccessToken()
    }

    public static async fetchAccessToken(appId:string, secret:string):Promise<any> {
        if(!G.conf.wxTokenUrl) return
        if(!this.accessTokenHolders[appId]) {
            this.createWechatTokenHolder(appId, secret)
        }
        let token = await this.accessTokenHolders[appId].fetchAccessToken()
        console.log(`token=${token}`)
        return token
    }

}
