import {TransactionType, Address, AggregateTransaction} from 'nem2-sdk'
import {AppMosaic, AppState, FormattedTransaction} from '@/core/model'
import {
  setNamespaces, getTransactionTypesFromAggregate, BalancesService,
  mosaicsAmountViewFromAddress, handleRecipientAddressAsNamespaceId,
} from '@/core/services'

const txTypeToGetNamespaces = [
  TransactionType.REGISTER_NAMESPACE,
  TransactionType.MOSAIC_ALIAS,
  TransactionType.ADDRESS_ALIAS,
]

const txTypeToSetAccountInfo = [
  TransactionType.LINK_ACCOUNT,
]

const txTypeToGetMultisigInfo = [
  TransactionType.MODIFY_MULTISIG_ACCOUNT,
]

/**
 * This module reacts to confirmed transactions
 * By default, the mosaic balances are checked everyTime
 */
export const onTransactionRefreshModule = (store: any) => { // @TODO: check how to type it
  store.registerModule('onTransactionRefresh', onTransactionRefreshModule)

  store.subscribe(async (mutation, state: AppState) => {
    if (mutation.type === 'ADD_UNCONFIRMED_TRANSACTION') {
      const formattedTransaction: FormattedTransaction = mutation.payload
      handleRecipientAddressAsNamespaceId([formattedTransaction], store)
    }

    if (mutation.type === 'ADD_CONFIRMED_TRANSACTION') {
      try {
        const {node} = state.account
        const {wallet} = state.account
        const {address} = state.account.wallet
        const accountAddress = Address.createFromRawAddress(address)

        const mosaicAmountViews = await mosaicsAmountViewFromAddress(node, accountAddress)
        const balances = BalancesService.getFromMosaicAmountViews(mosaicAmountViews)
        const appMosaics = mosaicAmountViews.map(x => AppMosaic.fromMosaicAmountView(x))

        store.commit('SET_ACCOUNT_BALANCES', {address: wallet.address, balances})
        store.commit('UPDATE_MOSAICS', appMosaics)

        const formattedTransaction: FormattedTransaction = mutation.payload
        const transaction = formattedTransaction.rawTx

        const transactionTypes: TransactionType[] = transaction instanceof AggregateTransaction
          ? getTransactionTypesFromAggregate(transaction)
          : [transaction.type]

        if (txTypeToGetNamespaces.some(a => transactionTypes.some(b => b === a))) {
          setNamespaces(address, store)
        }

        if (txTypeToSetAccountInfo.some(a => transactionTypes.some(b => b === a))) {
          wallet.setAccountInfo(store)
        }

        if (txTypeToGetMultisigInfo.some(a => transactionTypes.some(b => b === a))) {
          wallet.setMultisigStatus(node, store)
        }

        handleRecipientAddressAsNamespaceId([formattedTransaction], store)
      } catch (error) {
        console.error(error)
      }
    }

    if (mutation.type === 'SET_TRANSACTION_LIST') {
      handleRecipientAddressAsNamespaceId(mutation.payload, store)
    }
  })
}
