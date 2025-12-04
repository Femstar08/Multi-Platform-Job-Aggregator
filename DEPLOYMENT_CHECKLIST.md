# Deployment Checklist - Job Aggregator

Use this checklist before deploying to production.

## Pre-Deployment

### Code Quality

- [ ] All files created and in correct locations
- [ ] No syntax errors in JavaScript files
- [ ] All imports/requires are correct
- [ ] No hardcoded credentials or secrets

### Testing

- [ ] Unit tests written for adapters
- [ ] Integration tests for adapter factory
- [ ] All tests passing: `npm test`
- [ ] Test coverage > 70%: `npm test -- --coverage`
- [ ] Manual testing with sample URLs

### Configuration

- [ ] `package.json` dependencies correct
- [ ] `actor.json` input schema complete
- [ ] `Dockerfile` configured properly
- [ ] `.gitignore` includes sensitive files
- [ ] Environment variables documented

### Documentation

- [ ] README.md complete
- [ ] QUICK_START.md with examples
- [ ] ARCHITECTURE.md explains design
- [ ] IMPLEMENTATION_GUIDE.md for developers
- [ ] Input examples provided

## Local Testing

### 1. Install Dependencies

```bash
cd job-aggregator
npm install
```

- [ ] No installation errors
- [ ] All dependencies installed

### 2. Run Tests

```bash
npm test
```

- [ ] All tests pass
- [ ] No warnings or errors

### 3. Test Locally

```bash
npm start
```

- [ ] Actor starts without errors
- [ ] Sample data extracted
- [ ] Output matches schema
- [ ] Logs are structured

### 4. Test Each Adapter

- [ ] LinkedIn adapter works
- [ ] Indeed adapter works
- [ ] Glassdoor adapter works
- [ ] Error handling works
- [ ] Pagination works

## Apify Platform Setup

### 1. Create Apify Account

- [ ] Account created at apify.com
- [ ] Email verified
- [ ] Payment method added (if needed)

### 2. Install Apify CLI

```bash
npm install -g apify-cli
apify login
```

- [ ] CLI installed
- [ ] Logged in successfully

### 3. Initialize Actor

```bash
cd job-aggregator
apify init
```

- [ ] Actor initialized
- [ ] `.apify` directory created

## Deployment

### 1. Push to Apify

```bash
apify push
```

- [ ] Build successful
- [ ] No build errors
- [ ] Actor appears in console

### 2. Configure Actor

In Apify Console:

- [ ] Actor name set
- [ ] Description added
- [ ] Categories selected (Jobs, Automation)
- [ ] README displayed correctly
- [ ] Input schema works
- [ ] Example inputs added

### 3. Test on Platform

- [ ] Run with example input
- [ ] Check output dataset
- [ ] Verify data quality
- [ ] Check logs for errors
- [ ] Test with proxies

### 4. Performance Testing

- [ ] Test with 10 jobs
- [ ] Test with 100 jobs
- [ ] Test with 1000 jobs
- [ ] Monitor memory usage
- [ ] Monitor compute units
- [ ] Check execution time

## Production Configuration

### Proxy Settings

- [ ] Proxy configuration tested
- [ ] Residential proxies work
- [ ] Country targeting works
- [ ] Rate limiting handled

### Error Handling

- [ ] Failed requests logged
- [ ] Retries configured
- [ ] Graceful degradation
- [ ] Error notifications set up

### Monitoring

- [ ] Logs are structured
- [ ] Metrics tracked
- [ ] Alerts configured
- [ ] Performance monitored

## Post-Deployment

### 1. Verify Functionality

- [ ] Run test scrape
- [ ] Check output quality
- [ ] Verify all fields present
- [ ] Test pagination
- [ ] Test error handling

### 2. Documentation

- [ ] Update README with live URL
- [ ] Add usage examples
- [ ] Document known issues
- [ ] Add troubleshooting guide

### 3. Monitoring Setup

- [ ] Set up scheduled runs
- [ ] Configure webhooks
- [ ] Set up alerts
- [ ] Monitor costs

### 4. Optimization

- [ ] Review execution time
- [ ] Optimize selectors
- [ ] Tune concurrency
- [ ] Adjust timeouts

## Maintenance Plan

### Weekly

- [ ] Check run success rate
- [ ] Review error logs
- [ ] Monitor costs
- [ ] Check data quality

### Monthly

- [ ] Update dependencies
- [ ] Review site changes
- [ ] Update selectors if needed
- [ ] Performance optimization

### Quarterly

- [ ] Add new job sites
- [ ] Enhance data extraction
- [ ] User feedback review
- [ ] Feature additions

## Rollback Plan

If issues occur:

1. [ ] Revert to previous version in Apify Console
2. [ ] Check logs for errors
3. [ ] Fix issues locally
4. [ ] Test thoroughly
5. [ ] Redeploy

## Success Criteria

- [ ] ✅ Actor deploys without errors
- [ ] ✅ All three sites scrape successfully
- [ ] ✅ Output matches unified schema
- [ ] ✅ Error handling works
- [ ] ✅ Pagination works
- [ ] ✅ Proxies work (if configured)
- [ ] ✅ Performance acceptable
- [ ] ✅ Costs within budget
- [ ] ✅ Documentation complete
- [ ] ✅ Monitoring active

## Common Issues & Solutions

### Issue: "Module not found"

**Solution**: Run `npm install` in project directory

### Issue: "Invalid URL"

**Solution**: Check URL format in adapter's `isValidUrl()` method

### Issue: "No jobs extracted"

**Solution**:

- Check if site structure changed
- Verify selectors in adapter
- Test extraction methods manually

### Issue: "Rate limited"

**Solution**:

- Enable proxy configuration
- Reduce concurrency
- Add delays between requests

### Issue: "Memory exceeded"

**Solution**:

- Reduce maxItems
- Optimize data storage
- Increase memory in actor.json

### Issue: "Timeout"

**Solution**:

- Increase timeout in actor.json
- Optimize extraction logic
- Reduce page load time

## Contact & Support

- **Apify Documentation**: https://docs.apify.com
- **Apify Community**: https://community.apify.com
- **GitHub Issues**: [Your repo URL]
- **Email**: [Your email]

## Final Checklist

Before marking as production-ready:

- [ ] All tests pass
- [ ] Documentation complete
- [ ] Deployed to Apify
- [ ] Test run successful
- [ ] Monitoring configured
- [ ] Team trained
- [ ] Backup plan ready
- [ ] Costs estimated
- [ ] Performance acceptable
- [ ] Ready for users! 🚀

---

**Deployment Date**: ******\_******

**Deployed By**: ******\_******

**Version**: 1.0.0

**Status**: ⬜ Ready | ⬜ In Progress | ⬜ Complete
