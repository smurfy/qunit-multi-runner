qunit-multi-runner
==================

[phantomjs](http://phantomjs.org/) runner for [QUnit](http://qunitjs.com) which supports multiple input files and outputs the results in jUnit.xml format.

Code is heavily based on the original QUnit phantomjs runner and the junit logger plugin.

Usage
-----

Directly from the console:

	phantomjs qunit-multi-runner.js tests/testsuite1.html tests/testsuite2.html > qunit-junit.xml

This will run testsuite1 and testsuite2 and outputs the results to a junit compatible xml.

The main usage is in a continues integration server such as jenkins.
Therefor the call needs to be in the build.xml.
Sample:

	<target name="qunit" description="Run QUnit tests using PhantomJS">
 		<fileset dir="${basedir}" id="qunitfiles.raw">
			<include name="**/tests/js/*.html" />
		</fileset>
		<pathconvert pathsep=" " property="qunitfiles.clean" refid="qunitfiles.raw" />
		<exec executable="phantomjs" output="${basedir}/build/logs/qunit-junit.xml">
			<arg line="${basedir}/qunit-multi-runner.js" />
			<arg line="${qunitfiles.clean}" />
		</exec>
	</target>
