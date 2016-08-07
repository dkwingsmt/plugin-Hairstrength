import { combineReducers } from 'redux'
import { observer, observe } from 'redux-observers'
import { set, forEach } from 'lodash'
import { store } from 'views/createStore'
import { basicSelector } from 'views/utils/selectors'
import { getRate, getMemberId, getFilePath, getFinalTime, getRefreshTime } from '../components/utils'
import {
  ACTIVE_RANK_UPDATE,
  RATE_HISTORY_SHOW,
  HISTORY_HIDE,
  RATE_TIME_UP,
  RATE_UPDATED,
  RATE_ACCOUNTED
} from './actions'
const REDUCER_EXTENSION_KEY = 'poi-plugin-senka-calc'
const { i18n } = window
const __ = i18n["poi-plugin-senka-calc"].__.bind(i18n["poi-plugin-senka-calc"])
/*
*    api_req_ranking/getlist	：ランキング
*    	api_count			：最大読み込み可能数？
*    	api_page_count		：最大ページ数
*    	api_disp_page		：表示中のページ
*    	api_list			：提督リスト
******************************************
*    		api_no			：順位   api_mxltvkpyuklh
*    		api_rank		：階級   api_pcumlrymlujh
*    		api_nickname	：提督名   api_mtjmdcwtvhdr
*    		api_comment		：コメント api_itbrdpdbkynm
*    		api_rate		：戦果　暗号化されている api_wuhnhojjxmke
*    		api_flag		：旗アイコン? 0=金色
*    		api_medals		：甲種勲章保有数
*/

// /kcsapi/api_get_member/record
// /kcsapi/api_req_ranking/getlist

// /kcsapi/api_port/port
// /kcsapi/api_req_mission/result
// /kcsapi/api_req_practice/battle_result
// /kcsapi/api_req_sortie/battleresult
// /kcsapi/api_req_combined_battle/battleresult
// /kcsapi/api_req_map/next

const apiMap = {
  api: 'mxltvkpyuklh',
  api_no: 'api_mxltvkpyuklh',
  api_rate: 'api_wuhnhojjxmke',
  api_nickname: 'api_mtjmdcwtvhdr'
}
const emptyRank = {
  api_no: -1,
  api_rate: -1,
  rate: -1
}

function rankListReducer(state, { type, body, postBody }) {
  switch (type) {
  // case '@@Response/kcsapi/api_req_ranking/getlist':
  case `@@Response/kcsapi/api_req_ranking/${apiMap.api}`:
    // const { api_no, api_rate } = body
    const api_no = body[apiMap.api_no]
    const api_rate = body[apiMap.api_rate]

    if (!getActiveRank().indexOf(api_no)) {
      return state
    }

    const memberId = getMemberId()
    let rankList = state.rankList
    rankList[api_no] = getRate(api_no, api_rate, memberId)

    return {
      ...state,
      rankList
    }
  }
}

// [1, 5, 20, 100, 500]
// const activeRank = [true, true, true, true, true]

function activeRankReducer(state, action) {
  switch (action.type) {
  case ACTIVE_RANK_UPDATE:
    return action.activeRank
  }
  return state
}

function histroyReducer(state, action) {
  switch (action.type) {
  case RATE_HISTORY_SHOW:
    return {
      ...state,
      historyShow: action.show
    }
  }
  return state
}

// export const emptyTimer = {
//   accounted: false,
//   accountTimeString: '',
//   nextAccountTime: -1,
//   refreshTimeString: '',
//   nextRefreshTime: -1
// }
function timerReducer(state, action) {
  switch (action.type) {
  case RATE_TIME_UP:
    return {
      ...state,
      isTimeUp: true
    }
  case RATE_UPDATED:
    return {
      ...state,
      isUpdated: true
    }
  case RATE_ACCOUNTED:
    return {
      ...state,
      accounted: true
    }
  }
  return state
}


const storePath = 'plugin-senka'
const path = state.plugin.poi_plugin_senka_calc
const storeItems = ['detail', 'custom']
const dataPath = join(APPDATA_PATH, 'senka-calc')

observe(store,[observer(
  (state) =>
    storePath.baseDetail,
  (dispatch, current, previous) =>
    localStorage.setItem(storePath, JSON.stringify(current))
)])


function saveHistoryData(historyData) {
  fileWriter.write(
    getFilePath(true),
    CSON.stringify({
      ...historyData
    })
  )
}
observe(store, [observer(
  (state) =>
    storePath.history.historyData,
  (dispatch, current, previous) =>
    saveHistoryData(current)
)])

const baseDetail = {
  custom: {
    baseExp: 0,
    baseRate: 0,
    customRate: false
  },
  rank: {
    exRate: [0, 0],
    activeRank: [true, true, true, true, true],
    rateList: [0, 0, 0, 0, 0],
    deltaList: [0, 0, 0, 0, 0]
  },
  timer: {
    updateTime: -1
  }
}

function getLocalStorage() {
  try {
    return JSON.parse(localStorage.getItem(storePath) || '{}')
  } catch (e) {
    return {}
  }
}

function initReducer(state, action) {
  if (!state) {
    // historyData
    const historyData = readJsonSync(getFilePath(true))
    // baseDetail
    let storeData = getLocalStorage()
    if (Object.keys(storeData).length === 0) {
      storeData = baseDetail
    }
    // accounted timer
    let accounted, eoAccounted, expAccounted, accountString, nextAccountTime
    const now = Date.now()
    const [normalTime, expTime, eoTime] = [getFinalTime(), getFinalTime('exp'), getFinalTime('eo')]
    if (now >= eoTime) {
      accounted = true
      eoAccounted = true
    } else if (now >= expTime) {
      expAccounted = true
      accountString = __('EO map final time')
      nextAccountTime = eoTime
    } else if (now >= normalTime) {
      accountString = __('Normal map final time')
      nextAccountTime = expTime
    } else if (now >= storeData.updateTime + 11 * 3600 * 1000) {
      storeData.rank.exRate[0] = storeData.rank.exRate[1]
      storeData.rank.exRate[1] = 0
      accounted = true
    } else {
      accountString = __('Account time')
      accounted = false
    }
    // refresh timer
    let refreshString = __("Refresh time")
    let nextRefreshTime = getRefreshTime()
    let isUpdated = [true, true, true, true, true]
    let isTimeUp = true
    // if not refreshed, mark as timeup
    if (storeData.timer.updateTime !== _refreshTime) {
      isUpdated = [false, false, false, false, false]
    } else {
      isTimeUp = false
      nextRefreshTime = getRefreshTime('next')
      forEach(storeData.rank.rankList, (rank, idx) => {
        if (rank === 0) {
          isUpdated[idx] = false
        }
      })
    }
    console.log('init');
    return {
      custom: {
        ...storeData.custom
      },
      rank: {
        ...storeData.rank
      },
      history: {
        historyShow: false,
        historyData
      },
      timer: {
        ...storeData.timer,
        accounted,
        eoAccounted,
        expAccounted,
        accountString,
        nextAccountTime,
        refreshString,
        nextRefreshTime,
        isUpdated,
        isTimeUp
      }
    }
  }
  return state
}

export default combineReducers({
  initReducer,
  rankList: rankListReducer,
  activeRank: activeRankReducer,
  history: histroyReducer,
  timer: timerReducer
})
