import React, {Component} from 'react';
import {ScrollView} from 'react-native';
import {withOnyx} from 'react-native-onyx';
import PropTypes from 'prop-types';
import _ from 'underscore';
import HeaderWithBackButton from '../../components/HeaderWithBackButton';
import Navigation from '../../libs/Navigation/Navigation';
import ScreenWrapper from '../../components/ScreenWrapper';
import ROUTES from '../../ROUTES';
import ONYXKEYS from '../../ONYXKEYS';
import CONST from '../../CONST';
import styles from '../../styles/styles';
import compose from '../../libs/compose';
import OfflineWithFeedback from '../../components/OfflineWithFeedback';
import withLocalize, {withLocalizePropTypes} from '../../components/withLocalize';
import * as Expensicons from '../../components/Icon/Expensicons';
import themeColors from '../../styles/themes/default';
import * as PolicyUtils from '../../libs/PolicyUtils';
import MenuItem from '../../components/MenuItem';
import * as Policy from '../../libs/actions/Policy';
import policyMemberPropType from '../policyMemberPropType';
import Permissions from '../../libs/Permissions';
import Button from '../../components/Button';
import FixedFooter from '../../components/FixedFooter';
import BlockingView from '../../components/BlockingViews/BlockingView';
import {withNetwork} from '../../components/OnyxProvider';
import * as ReimbursementAccountProps from '../ReimbursementAccount/reimbursementAccountPropTypes';
import * as ReportUtils from '../../libs/ReportUtils';
import * as CurrencyUtils from '../../libs/CurrencyUtils';

const propTypes = {
    /* Onyx Props */

    /** The list of this user's policies */
    policies: PropTypes.objectOf(
        PropTypes.shape({
            /** The ID of the policy */
            ID: PropTypes.string,

            /** The name of the policy */
            name: PropTypes.string,

            /** The type of the policy */
            type: PropTypes.string,

            /** The user's role in the policy */
            role: PropTypes.string,

            /** The current action that is waiting to happen on the policy */
            pendingAction: PropTypes.oneOf(_.values(CONST.RED_BRICK_ROAD_PENDING_ACTION)),
        }),
    ),

    /** Bank account attached to free plan */
    reimbursementAccount: ReimbursementAccountProps.reimbursementAccountPropTypes,

    /** List of policy members */
    policyMembers: PropTypes.objectOf(policyMemberPropType),

    /** The user's wallet account */
    userWallet: PropTypes.shape({
        /** The user's current wallet balance */
        currentBalance: PropTypes.number,
    }),

    /** List of betas available to current user */
    betas: PropTypes.arrayOf(PropTypes.string),

    ...withLocalizePropTypes,
};

const defaultProps = {
    policies: {},
    policyMembers: {},
    reimbursementAccount: {},
    userWallet: {
        currentBalance: 0,
    },
    betas: [],
};

/**
 * Dismisses the errors on one item
 *
 * @param {string} policyID
 * @param {string} pendingAction
 */
function dismissWorkspaceError(policyID, pendingAction) {
    if (pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE) {
        Policy.clearDeleteWorkspaceError(policyID);
        return;
    }

    if (pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD) {
        Policy.removeWorkspace(policyID);
        return;
    }
    throw new Error('Not implemented');
}

class WorkspacesListPage extends Component {
    constructor(props) {
        super(props);

        this.getWalletBalance = this.getWalletBalance.bind(this);
        this.getWorkspaces = this.getWorkspaces.bind(this);
        this.getMenuItem = this.getMenuItem.bind(this);
    }

    /**
     * @param {Boolean} isPaymentItem whether the item being rendered is the payments menu item
     * @returns {Number} the user wallet balance
     */
    getWalletBalance(isPaymentItem) {
        return isPaymentItem && Permissions.canUseWallet(this.props.betas) ? CurrencyUtils.convertToDisplayString(this.props.userWallet.currentBalance) : undefined;
    }

    /**
     * Add free policies (workspaces) to the list of menu items and returns the list of menu items
     * @returns {Array} the menu item list
     */
    getWorkspaces() {
        const reimbursementAccountBrickRoadIndicator = !_.isEmpty(this.props.reimbursementAccount.errors) ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : '';
        return _.chain(this.props.policies)
            .filter((policy) => PolicyUtils.shouldShowPolicy(policy, this.props.network.isOffline))
            .map((policy) => ({
                title: policy.name,
                icon: policy.avatar ? policy.avatar : ReportUtils.getDefaultWorkspaceAvatar(policy.name),
                iconType: policy.avatar ? CONST.ICON_TYPE_AVATAR : CONST.ICON_TYPE_ICON,
                action: () => Navigation.navigate(ROUTES.getWorkspaceInitialRoute(policy.id)),
                iconFill: themeColors.textLight,
                fallbackIcon: Expensicons.FallbackWorkspaceAvatar,
                brickRoadIndicator: reimbursementAccountBrickRoadIndicator || PolicyUtils.getPolicyBrickRoadIndicatorStatus(policy, this.props.policyMembers),
                pendingAction: policy.pendingAction,
                errors: policy.errors,
                dismissError: () => dismissWorkspaceError(policy.id, policy.pendingAction),
                disabled: policy.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE,
            }))
            .sortBy((policy) => policy.title.toLowerCase())
            .value();
    }

    /**
     * Gets the menu item for each workspace
     *
     * @param {Object} item
     * @param {Number} index
     * @returns {JSX}
     */
    getMenuItem(item, index) {
        const keyTitle = item.translationKey ? this.props.translate(item.translationKey) : item.title;
        const isPaymentItem = item.translationKey === 'common.payments';

        return (
            <OfflineWithFeedback
                key={`${keyTitle}_${index}`}
                pendingAction={item.pendingAction}
                errorRowStyles={styles.offlineFeedback.menuItemErrorPadding}
                onClose={item.dismissError}
                errors={item.errors}
            >
                <MenuItem
                    title={keyTitle}
                    icon={item.icon}
                    iconType={CONST.ICON_TYPE_WORKSPACE}
                    onPress={item.action}
                    iconStyles={item.iconStyles}
                    iconFill={item.iconFill}
                    shouldShowRightIcon
                    badgeText={this.getWalletBalance(isPaymentItem)}
                    fallbackIcon={item.fallbackIcon}
                    brickRoadIndicator={item.brickRoadIndicator}
                    disabled={item.disabled}
                />
            </OfflineWithFeedback>
        );
    }

    render() {
        const workspaces = this.getWorkspaces();
        return (
            <ScreenWrapper>
                <HeaderWithBackButton
                    title={this.props.translate('common.workspaces')}
                    onBackButtonPress={() => Navigation.goBack(ROUTES.SETTINGS)}
                />
                {_.isEmpty(workspaces) ? (
                    <BlockingView
                        icon={Expensicons.Building}
                        title={this.props.translate('workspace.emptyWorkspace.title')}
                        subtitle={this.props.translate('workspace.emptyWorkspace.subtitle')}
                    />
                ) : (
                    <ScrollView style={styles.flex1}>{_.map(workspaces, (item, index) => this.getMenuItem(item, index))}</ScrollView>
                )}
                <FixedFooter style={[styles.flexGrow0]}>
                    <Button
                        accessibilityLabel={this.props.translate('workspace.new.newWorkspace')}
                        success
                        text={this.props.translate('workspace.new.newWorkspace')}
                        onPress={() => Policy.createWorkspace()}
                    />
                </FixedFooter>
            </ScreenWrapper>
        );
    }
}

WorkspacesListPage.propTypes = propTypes;
WorkspacesListPage.defaultProps = defaultProps;

export default compose(
    withLocalize,
    withNetwork(),
    withOnyx({
        policies: {
            key: ONYXKEYS.COLLECTION.POLICY,
        },
        policyMembers: {
            key: ONYXKEYS.COLLECTION.POLICY_MEMBER_LIST,
        },
        reimbursementAccount: {
            key: ONYXKEYS.REIMBURSEMENT_ACCOUNT,
        },
        userWallet: {
            key: ONYXKEYS.USER_WALLET,
        },
        betas: {
            key: ONYXKEYS.BETAS,
        },
    }),
)(WorkspacesListPage);
